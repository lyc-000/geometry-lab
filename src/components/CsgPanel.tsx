import { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Combine,
  Crosshair,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  createBufferGeometryFromData,
  getGeometryStats,
} from '../lib/geometry';
import { CsgWorkerError, runCsgInWorker } from '../lib/csg-worker-client';
import { RESULT_COLOR } from '../lib/colors';
import { delay, describeKind, formatCount } from '../lib/utils';
import { useStudioStore } from '../store/useStudioStore';
import type { BooleanOperation } from '../types';
import {
  EmptyState,
  SectionHeading,
  SelectField,
  type SelectOption,
} from './ui';

const OPERATIONS: Array<{
  value: BooleanOperation;
  symbol: string;
  title: string;
  hint: string;
}> = [
  { value: 'subtract', symbol: '−', title: '差集', hint: '用 B 切 A' },
  { value: 'intersect', symbol: '∩', title: '交集', hint: '保留公共部分' },
  { value: 'union', symbol: '∪', title: '并集', hint: '合并两个实体' },
];

function OperationGlyph({ operation }: { operation: BooleanOperation }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `op-mask-${id}`;
  const clipId = `op-clip-${id}`;

  return (
    <svg viewBox="0 0 54 32" className="op-glyph" aria-hidden>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="54" height="32">
          <rect width="54" height="32" fill="white" />
          <circle cx="32" cy="16" r="9" fill="black" />
        </mask>
        <clipPath id={clipId}>
          <circle cx="22" cy="16" r="9" />
        </clipPath>
      </defs>
      {operation === 'union' ? (
        <>
          <circle cx="22" cy="16" r="9" fill="currentColor" opacity=".16" />
          <circle cx="32" cy="16" r="9" fill="currentColor" opacity=".16" />
        </>
      ) : null}
      {operation === 'subtract' ? (
        <circle cx="22" cy="16" r="9" fill="currentColor" opacity=".82" mask={`url(#${maskId})`} />
      ) : null}
      {operation === 'intersect' ? (
        <g clipPath={`url(#${clipId})`}>
          <circle cx="32" cy="16" r="9" fill="currentColor" opacity=".82" />
        </g>
      ) : null}
      <circle cx="22" cy="16" r="9" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.2" />
      <circle cx="32" cy="16" r="9" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.2" />
      {operation === 'union' ? (
        <path d="M22 7a9 9 0 0 0 0 18 9 9 0 0 0 0-18Z" fill="none" stroke="currentColor" strokeOpacity=".2" />
      ) : null}
    </svg>
  );
}

export function CsgPanel() {
  const objects = useStudioStore((state) => state.objects);
  const csgA = useStudioStore((state) => state.csgA);
  const csgB = useStudioStore((state) => state.csgB);
  const operation = useStudioStore((state) => state.csgOperation);
  const setCsgA = useStudioStore((state) => state.setCsgA);
  const setCsgB = useStudioStore((state) => state.setCsgB);
  const setCsgOperation = useStudioStore((state) => state.setCsgOperation);
  const swapCsgPair = useStudioStore((state) => state.swapCsgPair);
  const clipEnabled = useStudioStore((state) => state.clipEnabled);
  const replaceWithResult = useStudioStore((state) => state.replaceWithResult);
  const pushToast = useStudioStore((state) => state.pushToast);
  const beginBusy = useStudioStore((state) => state.beginBusy);
  const endBusy = useStudioStore((state) => state.endBusy);
  const overlapPreview = useStudioStore((state) => state.overlapPreview);
  const setOverlapPreview = useStudioStore((state) => state.setOverlapPreview);
  const clearOverlapPreview = useStudioStore((state) => state.clearOverlapPreview);
  const [busyCsg, setBusyCsg] = useState(false);
  const [showOverlap, setShowOverlap] = useState(false);

  const objectA = useMemo(() => objects.find((object) => object.id === csgA) ?? null, [objects, csgA]);
  const objectB = useMemo(() => objects.find((object) => object.id === csgB) ?? null, [objects, csgB]);
  const sameObject = Boolean(objectA && objectB && objectA.id === objectB.id);
  const canRun = Boolean(objectA && objectB) && !sameObject && !busyCsg;
  const activeOperation = OPERATIONS.find((item) => item.value === operation) ?? OPERATIONS[0];

  const options: SelectOption[] = objects.map((object) => ({
    value: object.id,
    label: `${object.name} · ${describeKind(object.kind, object.meta)}`,
    hint: object.visible ? `${formatCount(object.triangleCount)} 面` : '已隐藏',
    swatch: object.color,
  }));

  useEffect(() => {
    setShowOverlap(false);
    clearOverlapPreview();
  }, [csgA, csgB, clearOverlapPreview]);

  useEffect(
    () => () => {
      clearOverlapPreview();
    },
    [clearOverlapPreview],
  );

  const toggleOverlap = async () => {
    if (showOverlap) {
      setShowOverlap(false);
      clearOverlapPreview();
      return;
    }
    if (!objectA || !objectB) {
      pushToast({
        variant: 'info',
        title: '请先选择两个对象',
        description: '重叠体积预览需要对象 A 与对象 B。',
      });
      return;
    }
    if (objectA.id === objectB.id) {
      pushToast({
        variant: 'error',
        title: '同一对象没有重叠区',
        description: '请为 A 和 B 选择不同的实体。',
      });
      return;
    }

    setShowOverlap(true);
    beginBusy({
      title: '正在计算重叠体积',
      detail: `${objectA.name} ∩ ${objectB.name} · three-bvh-csg 求交 · 稍后将高亮公共区域`,
    });
    const startedAt = Date.now();

    try {
      const payload = await runCsgInWorker({
        operation: 'intersect',
        a: objectA.geometry,
        b: objectB.geometry,
      });
      const geometry = createBufferGeometryFromData(
        payload.positions,
        payload.normals,
        payload.indices,
      );
      const stats = getGeometryStats(geometry);
      setOverlapPreview({
        geometry,
        aId: objectA.id,
        bId: objectB.id,
        aName: objectA.name,
        bName: objectB.name,
        triangleCount: stats.triangleCount,
        vertexCount: stats.vertexCount,
        createdAt: Date.now(),
      });
      pushToast({
        variant: 'success',
        title: `${objectA.name} ∩ ${objectB.name} 重叠区已高亮`,
        description: '金色体积为两实体的公共部分；A / B 暂时半透明。',
      });
    } catch (error) {
      setShowOverlap(false);
      clearOverlapPreview();
      const message =
        error instanceof CsgWorkerError
          ? error.message
          : error instanceof Error
            ? error.message
            : '重叠区域计算失败。';
      pushToast({
        variant: 'error',
        title: '没有可显示的重叠区域',
        description: message,
        duration: 7200,
      });
    } finally {
      const minimum = 520;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimum) await delay(minimum - elapsed);
      endBusy();
    }
  };

  const runBoolean = async () => {
    if (!objectA || !objectB) {
      pushToast({
        variant: 'info',
        title: '请选择两个对象',
        description: '布尔运算需要对象 A 与对象 B。',
      });
      return;
    }
    if (objectA.id === objectB.id) {
      pushToast({
        variant: 'error',
        title: '不能对同一对象运算',
        description: '请为 A 和 B 选择不同的实体。',
      });
      return;
    }

    setShowOverlap(false);
    clearOverlapPreview();
    setBusyCsg(true);
    beginBusy({
      title: `正在执行布尔${activeOperation.title}`,
      detail: `${objectA.name} ${activeOperation.symbol} ${objectB.name} · three-bvh-csg · 世界矩阵同步`,
    });
    const startedAt = Date.now();

    try {
      const payload = await runCsgInWorker({
        operation,
        a: objectA.geometry,
        b: objectB.geometry,
      });
      const resultGeometry = createBufferGeometryFromData(
        payload.positions,
        payload.normals,
        payload.indices,
      );
      const stats = getGeometryStats(resultGeometry);
      const created = replaceWithResult([objectA.id, objectB.id], {
        label: activeOperation.title,
        kind: 'csg',
        geometry: resultGeometry,
        triangleCount: stats.triangleCount,
        vertexCount: stats.vertexCount,
        color: RESULT_COLOR,
        meta: {
          operation,
          sourceNames: [objectA.name, objectB.name],
          params: {
            expression: `${objectA.name} ${activeOperation.symbol} ${objectB.name}`,
            output: `${formatCount(stats.triangleCount)} faces`,
          },
        },
      });

      if (created) {
        pushToast({
          variant: 'success',
          title: `${created.name} = ${objectA.name} ${activeOperation.symbol} ${objectB.name}`,
          description: `${activeOperation.title}完成 · ${formatCount(stats.triangleCount)} 个三角面 · 原对象已移除并释放显存。`,
        });
      }
    } catch (error) {
      const message =
        error instanceof CsgWorkerError
          ? error.message
          : error instanceof Error
            ? error.message
            : '布尔运算失败。';
      pushToast({
        variant: 'error',
        title: '布尔运算未完成',
        description: message,
        duration: 8200,
      });
    } finally {
      const minimum = 700;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimum) await delay(minimum - elapsed);
      setBusyCsg(false);
      endBusy();
    }
  };

  if (objects.length === 0) {
    return (
      <section className="panel-section">
        <SectionHeading index="02" title="实体布尔" kicker="CSG / BOOLEAN" />
        <EmptyState
          icon={<Combine size={22} strokeWidth={1.5} />}
          title="还没有可运算的对象"
          description="先在左侧创建至少两个封闭实体，再执行差集、交集或并集。"
        />
      </section>
    );
  }

  return (
    <section className="panel-section">
      <SectionHeading
        index="02"
        title="实体布尔"
        kicker="CSG / BOOLEAN"
        trailing={<span className="engine-mini">three-bvh-csg</span>}
      />

      <p className="panel-intro">
        把两个水密实体交给 three-bvh-csg 求值。运算前会更新世界矩阵，
        结果替换 A、B 并同步释放旧几何体显存。
      </p>

      <div className="csg-pair">
        <div className={`csg-object-card ${objectA ? 'has-value' : ''}`}>
          <div className="csg-object-label">
            <span className="pair-letter pair-a">A</span>
            <span>被操作对象</span>
          </div>
          <SelectField
            value={csgA}
            onValueChange={setCsgA}
            options={options}
            placeholder="选择对象 A"
            ariaLabel="选择对象 A"
          />
          {objectA ? (
            <div className="csg-object-meta">
              <span>{describeKind(objectA.kind, objectA.meta)}</span>
              <span>{formatCount(objectA.triangleCount)} 面</span>
            </div>
          ) : (
            <div className="csg-object-meta is-muted">尚未指定</div>
          )}
        </div>

        <button
          type="button"
          className="swap-button"
          onClick={swapCsgPair}
          disabled={!objectA && !objectB}
          aria-label="交换对象 A 与 B"
          title="交换 A / B"
        >
          <ArrowLeftRight size={14} strokeWidth={1.8} />
        </button>

        <div className={`csg-object-card ${objectB ? 'has-value' : ''}`}>
          <div className="csg-object-label">
            <span className="pair-letter pair-b">B</span>
            <span>切割对象</span>
          </div>
          <SelectField
            value={csgB}
            onValueChange={setCsgB}
            options={options}
            placeholder="选择对象 B"
            ariaLabel="选择对象 B"
          />
          {objectB ? (
            <div className="csg-object-meta">
              <span>{describeKind(objectB.kind, objectB.meta)}</span>
              <span>{formatCount(objectB.triangleCount)} 面</span>
            </div>
          ) : (
            <div className="csg-object-meta is-muted">尚未指定</div>
          )}
        </div>
      </div>

      {sameObject ? (
        <div className="inline-warning">
          <AlertTriangle size={13} strokeWidth={2} />
          A 与 B 是同一个对象，请更改其中一个选择。
        </div>
      ) : null}

      <div className="operation-grid" role="radiogroup" aria-label="布尔运算类型">
        {OPERATIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={operation === item.value}
            className={`operation-card ${operation === item.value ? 'is-active' : ''}`}
            onClick={() => setCsgOperation(item.value)}
          >
            <OperationGlyph operation={item.value} />
            <span className="op-formula">
              A {item.symbol} B
            </span>
            <span className="op-title">{item.title}</span>
            <span className="op-hint">{item.hint}</span>
            <span className="op-radio-dot" aria-hidden />
          </button>
        ))}
      </div>

      <div className="csg-equation-strip">
        <span className="csg-equation-label">EXPRESSION</span>
        <span className="csg-equation-value">
          {objectA?.name ?? 'A'} <span className="op-symbol">{activeOperation.symbol}</span>{' '}
          {objectB?.name ?? 'B'}
        </span>
        <span className="csg-equation-sub">{activeOperation.title}</span>
      </div>

      <div className={`overlap-preview-card ${showOverlap ? 'is-active' : ''}`}>
        <div className="overlap-preview-copy">
          <div className="overlap-preview-title">
            <span className="overlap-dot" />
            重叠体积
            <span className="overlap-formula">A ∩ B</span>
          </div>
          <p>
            布尔切割前，把两个实体的公共体积高亮成金色，A / B 暂时变为半透明，
            方便检查哪里会被切掉。
          </p>
          {overlapPreview ? (
            <span className="overlap-preview-stat">
              当前公共体积 · {formatCount(overlapPreview.triangleCount)} 三角面
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="overlap-preview-button"
          onClick={toggleOverlap}
          aria-pressed={showOverlap}
          disabled={!objectA || !objectB || sameObject}
        >
          <Crosshair size={13} strokeWidth={1.9} />
          {showOverlap ? '关闭高亮' : '高亮重叠'}
        </button>
      </div>

      {clipEnabled ? (
        <div className="inline-info">
          <Sparkles size={13} strokeWidth={1.8} />
          视觉裁剪当前开启：布尔运算仍使用完整几何体。若需要被平面切掉后的实体，请先在“剖切”页固化。
        </div>
      ) : null}

      <button
        type="button"
        className="primary-button full-button csg-run-button"
        onClick={runBoolean}
        disabled={!canRun}
      >
        {busyCsg ? <Loader2 size={15} className="spin" /> : <Combine size={15} strokeWidth={2} />}
        执行{activeOperation.title}
        {objectA && objectB ? (
          <span className="button-context">
            {objectA.name} {activeOperation.symbol} {objectB.name}
          </span>
        ) : null}
      </button>

      <div className="tech-strip">
        <span><ShieldCheck size={12} strokeWidth={1.9} />水密输入</span>
        <span><span className="tech-dot" />updateMatrixWorld(true)</span>
        <span>Worker 计算</span>
      </div>

      <p className="form-note">
        差集是最常用的建模方式：A 为主体，B 为刀具。原始对象在成功后移除，
        可通过顶部“示例”恢复演示。
      </p>
    </section>
  );
}
