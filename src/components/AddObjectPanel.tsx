import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Box,
  ChevronDown,
  Circle,
  Cylinder,
  Loader2,
  Plus,
  Sigma,
  Sparkles,
} from 'lucide-react';
import {
  createBoxSolid,
  createCylinderSolid,
  createImplicitGeometry,
  createSphereSolid,
  getGeometryStats,
} from '../lib/geometry';
import { generateImplicitMeshInWorker, ImplicitWorkerError } from '../lib/implicit-worker-client';
import { EquationError, parseRelation } from '../lib/relation';
import { delay, parseNumericInput } from '../lib/utils';
import { useStudioStore } from '../store/useStudioStore';
import type { Axis, PrimitiveKind, Vec3 } from '../types';
import {
  AxisField,
  EquationField,
  NumericField,
  SectionHeading,
  SegmentedControl,
  SelectField,
} from './ui';

const KIND_CARDS: Array<{
  kind: PrimitiveKind;
  label: string;
  hint: string;
  icon: ReactNode;
}> = [
  { kind: 'sphere', label: '球体', hint: 'SPHERE', icon: <Circle size={17} strokeWidth={1.6} /> },
  { kind: 'cylinder', label: '圆柱', hint: 'CYLINDER', icon: <Cylinder size={17} strokeWidth={1.6} /> },
  { kind: 'box', label: '长方体', hint: 'BOX', icon: <Box size={17} strokeWidth={1.6} /> },
  { kind: 'implicit', label: '方程', hint: 'IMPLICIT', icon: <Sigma size={17} strokeWidth={1.6} /> },
];

const PRESETS = [
  { label: '球面', expression: 'x^2 + y^2 + z^2 <= 4' },
  { label: '椭球', expression: 'x^2/4 + y^2/2 + z^2/1.5 <= 1' },
  { label: '八面体', expression: 'abs(x) + abs(y) + abs(z) <= 2' },
  { label: '封闭方程', expression: 'x^2 + y^2 + z^2 = 4' },
];

interface PrimitiveFormState {
  cx: string;
  cy: string;
  cz: string;
  radius: string;
  height: string;
  sx: string;
  sy: string;
  sz: string;
  axis: Axis;
}

const INITIAL_PRIMITIVE: PrimitiveFormState = {
  cx: '0',
  cy: '0',
  cz: '1.8',
  radius: '1.8',
  height: '3.6',
  sx: '2.4',
  sy: '2.4',
  sz: '3',
  axis: 'z',
};

const RESOLUTION_OPTIONS = [
  { value: '24', label: '24³ · 快速', hint: '适合预览' },
  { value: '32', label: '32³ · 标准', hint: '日常推荐' },
  { value: '40', label: '40³ · 精细', hint: '更平滑的曲面' },
  { value: '48', label: '48³ · 高清', hint: '计算时间增加' },
  { value: '56', label: '56³ · 极致', hint: '较大网格 / 较慢' },
];

function parseVector(
  a: string,
  b: string,
  c: string,
  fieldName: string,
): { value: Vec3 } | { error: string } {
  const x = parseNumericInput(a);
  const y = parseNumericInput(b);
  const z = parseNumericInput(c);
  if (x === null || y === null || z === null) {
    return { error: `${fieldName}的 X / Y / Z 坐标必须是有限数值。` };
  }
  return { value: [x, y, z] };
}

function positive(
  raw: string,
  label: string,
): { value: number } | { error: string } {
  const value = parseNumericInput(raw);
  if (value === null || !Number.isFinite(value)) {
    return { error: `${label}必须是有限数值。` };
  }
  if (value <= 0) return { error: `${label}必须大于 0。` };
  if (value > 400) return { error: `${label}不能超过 400。` };
  return { value };
}

export function AddObjectPanel() {
  const addSolid = useStudioStore((state) => state.addSolid);
  const pushToast = useStudioStore((state) => state.pushToast);
  const beginBusy = useStudioStore((state) => state.beginBusy);
  const endBusy = useStudioStore((state) => state.endBusy);

  const kind = useStudioStore((state) => state.creationMode);
  const setKind = useStudioStore((state) => state.setCreationMode);
  const [primitive, setPrimitive] = useState<PrimitiveFormState>(INITIAL_PRIMITIVE);
  const [equation, setEquation] = useState('x^2 + y^2 + z^2 <= 4');
  const [resolution, setResolution] = useState('32');
  const [domainMin, setDomainMin] = useState({ x: '-6', y: '-6', z: '-6' });
  const [domainMax, setDomainMax] = useState({ x: '6', y: '6', z: '6' });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyGenerating, setBusyGenerating] = useState(false);
  const [implicitHint, setImplicitHint] = useState<string | null>(null);

  const parsedRelation = useMemo(() => {
    try {
      return { relation: parseRelation(equation), error: null as string | null };
    } catch (error) {
      return {
        relation: null,
        error: error instanceof Error ? error.message : '方程无法解析。',
      };
    }
  }, [equation]);

  const updatePrimitive = (key: keyof PrimitiveFormState, value: string | Axis) => {
    setPrimitive((current) => ({ ...current, [key]: value }));
    setFormError(null);
  };

  const addPrimitive = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const center = parseVector(primitive.cx, primitive.cy, primitive.cz, '中心');
    if ('error' in center) {
      setFormError(center.error);
      pushToast({ variant: 'error', title: '参数无效', description: center.error });
      return;
    }

    try {
      let geometry;
      let label = '';
      let meta: Record<string, string | number> = {};

      if (kind === 'sphere') {
        const radius = positive(primitive.radius, '半径');
        if ('error' in radius) throw new Error(radius.error);
        geometry = createSphereSolid(center.value, radius.value);
        label = '球体';
        meta = {
          center: center.value.map((value) => value.toFixed(2)).join(', '),
          radius: radius.value,
        };
      } else if (kind === 'cylinder') {
        const radius = positive(primitive.radius, '半径');
        if ('error' in radius) throw new Error(radius.error);
        const height = positive(primitive.height, '高度');
        if ('error' in height) throw new Error(height.error);
        geometry = createCylinderSolid(center.value, radius.value, height.value, primitive.axis);
        label = '圆柱体';
        meta = {
          center: center.value.map((value) => value.toFixed(2)).join(', '),
          radius: radius.value,
          height: height.value,
          axis: primitive.axis.toUpperCase(),
        };
      } else if (kind === 'box') {
        const sx = positive(primitive.sx, 'X 方向长度');
        if ('error' in sx) throw new Error(sx.error);
        const sy = positive(primitive.sy, 'Y 方向长度');
        if ('error' in sy) throw new Error(sy.error);
        const sz = positive(primitive.sz, 'Z 方向长度');
        if ('error' in sz) throw new Error(sz.error);
        geometry = createBoxSolid(center.value, [sx.value, sy.value, sz.value]);
        label = '长方体';
        meta = {
          center: center.value.map((value) => value.toFixed(2)).join(', '),
          size: `${sx.value} × ${sy.value} × ${sz.value}`,
        };
      } else {
        throw new Error('请选择基础立体类型。');
      }

      const stats = getGeometryStats(geometry);
      const created = addSolid({
        label,
        kind,
        geometry,
        triangleCount: stats.triangleCount,
        vertexCount: stats.vertexCount,
        meta: { params: meta },
      });
      pushToast({
        variant: 'success',
        title: `对象 ${created.name} 已添加`,
        description: `${label} · ${stats.triangleCount.toLocaleString('zh-CN')} 个三角面`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '实体生成失败。';
      setFormError(message);
      pushToast({ variant: 'error', title: '无法添加实体', description: message });
    }
  };

  const addImplicit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setImplicitHint(null);

    if (!parsedRelation.relation) {
      const message = parsedRelation.error ?? '方程无法解析。';
      setFormError(message);
      pushToast({ variant: 'error', title: '方程无效', description: message });
      return;
    }

    const minX = parseNumericInput(domainMin.x);
    const minY = parseNumericInput(domainMin.y);
    const minZ = parseNumericInput(domainMin.z);
    const maxX = parseNumericInput(domainMax.x);
    const maxY = parseNumericInput(domainMax.y);
    const maxZ = parseNumericInput(domainMax.z);
    if ([minX, minY, minZ, maxX, maxY, maxZ].some((value) => value === null)) {
      const message = '采样范围的 6 个边界值都必须是有限数值。';
      setFormError(message);
      pushToast({ variant: 'error', title: '采样范围无效', description: message });
      return;
    }

    const mins: Vec3 = [minX as number, minY as number, minZ as number];
    const maxs: Vec3 = [maxX as number, maxY as number, maxZ as number];
    for (let axis = 0; axis < 3; axis += 1) {
      if (maxs[axis] <= mins[axis]) {
        const message = `采样范围第 ${axis + 1} 轴的最大值必须大于最小值。`;
        setFormError(message);
        pushToast({ variant: 'error', title: '采样范围无效', description: message });
        return;
      }
    }

    const res = Number(resolution);
    const relation = parsedRelation.relation;
    setBusyGenerating(true);
    beginBusy({
      title: '正在构建隐式实体',
      detail: `Marching Cubes · ${res}³ 采样 · 自动执行水密性校验`,
    });
    const startedAt = Date.now();

    try {
      const payload = await generateImplicitMeshInWorker({
        expression: relation.source,
        resolution: res,
        domain: [mins, maxs],
      });

      const geometry = createImplicitGeometry(payload);
      const stats = getGeometryStats(geometry);
      const created = addSolid({
        label: '隐式实体',
        kind: 'implicit',
        geometry,
        triangleCount: stats.triangleCount,
        vertexCount: stats.vertexCount,
        meta: {
          equation: relation.source,
          latex: relation.latex,
          domain: [mins, maxs],
          resolution: res,
          algorithm: 'Marching Cubes',
          params: {
            domain: `[${mins.join(', ')}] → [${maxs.join(', ')}]`,
            resolution: `${res}³`,
          },
        },
      });

      setImplicitHint(
        `水密校验通过 · ${stats.triangleCount.toLocaleString('zh-CN')} 个三角面 · 法线已朝外`,
      );
      pushToast({
        variant: 'success',
        title: `对象 ${created.name} 已生成`,
        description: `${stats.triangleCount.toLocaleString('zh-CN')} 面，已通过封闭性校验，可参与 CSG。`,
      });
    } catch (error) {
      const message =
        error instanceof ImplicitWorkerError || error instanceof EquationError
          ? error.message
          : error instanceof Error
            ? error.message
            : '隐式实体生成失败。';
      setFormError(message);
      pushToast({
        variant: 'error',
        title: '无法生成封闭实体',
        description: message,
        duration: 7600,
      });
    } finally {
      const minimum = 600;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimum) await delay(minimum - elapsed);
      setBusyGenerating(false);
      endBusy();
    }
  };

  const isImplicit = kind === 'implicit';
  const activeCard = KIND_CARDS.find((card) => card.kind === kind);

  return (
    <section className="panel-section">
      <SectionHeading index="01" title="创建实体" kicker="BUILD / SOLID" />

      <div className="type-grid" role="tablist" aria-label="实体类型">
        {KIND_CARDS.map((card) => (
          <button
            key={card.kind}
            type="button"
            role="tab"
            aria-selected={kind === card.kind}
            className={`type-card ${kind === card.kind ? 'is-active' : ''}`}
            onClick={() => {
              setKind(card.kind);
              setFormError(null);
              setImplicitHint(null);
            }}
          >
            <span className="type-icon">{card.icon}</span>
            <span className="type-name">{card.label}</span>
            <span className="type-hint">{card.hint}</span>
          </button>
        ))}
      </div>

      {!isImplicit ? (
        <form className="creation-form" onSubmit={addPrimitive}>
          <div className="form-block">
            <div className="form-block-label">中心坐标</div>
            <div className="axis-grid">
              <AxisField axis="x" value={primitive.cx} onChange={(value) => updatePrimitive('cx', value)} />
              <AxisField axis="y" value={primitive.cy} onChange={(value) => updatePrimitive('cy', value)} />
              <AxisField axis="z" value={primitive.cz} onChange={(value) => updatePrimitive('cz', value)} />
            </div>
          </div>

          {kind === 'sphere' ? (
            <NumericField
              label="半径 R"
              value={primitive.radius}
              onChange={(value) => updatePrimitive('radius', value)}
              suffix="unit"
            />
          ) : null}

          {kind === 'cylinder' ? (
            <>
              <div className="two-col">
                <NumericField
                  label="半径 R"
                  value={primitive.radius}
                  onChange={(value) => updatePrimitive('radius', value)}
                  suffix="unit"
                />
                <NumericField
                  label="高度 H"
                  value={primitive.height}
                  onChange={(value) => updatePrimitive('height', value)}
                  suffix="unit"
                />
              </div>
              <div className="form-block">
                <div className="form-block-label">轴向</div>
                <SegmentedControl<Axis>
                  value={primitive.axis}
                  onChange={(axis) => updatePrimitive('axis', axis)}
                  options={[
                    { value: 'x', label: 'X 轴' },
                    { value: 'y', label: 'Y 轴' },
                    { value: 'z', label: 'Z 轴' },
                  ]}
                  ariaLabel="圆柱轴向"
                  className="segmented-compact"
                />
              </div>
            </>
          ) : null}

          {kind === 'box' ? (
            <div className="form-block">
              <div className="form-block-label">尺寸 X / Y / Z</div>
              <div className="axis-grid">
                <AxisField axis="x" value={primitive.sx} onChange={(value) => updatePrimitive('sx', value)} />
                <AxisField axis="y" value={primitive.sy} onChange={(value) => updatePrimitive('sy', value)} />
                <AxisField axis="z" value={primitive.sz} onChange={(value) => updatePrimitive('sz', value)} />
              </div>
            </div>
          ) : null}

          {formError ? (
            <div className="form-error">
              <AlertTriangle size={13} strokeWidth={2} />
              <span>{formError}</span>
            </div>
          ) : null}

          <button type="submit" className="primary-button add-button">
            <Plus size={15} strokeWidth={2.2} />
            添加{activeCard?.label ?? '实体'}
            <span className="button-tail">ADD</span>
          </button>
          <p className="form-note">参数直接使用世界坐标；生成后可点击视口或对象列表选中。</p>
        </form>
      ) : (
        <form className="creation-form" onSubmit={addImplicit}>
          <EquationField
            label="隐式方程 / 不等式"
            value={equation}
            onChange={(value) => {
              setEquation(value);
              setFormError(null);
              setImplicitHint(null);
            }}
            placeholder="例如 x^2 + y^2 + z^2 <= 9"
            previewLatex={parsedRelation.relation?.latex}
            error={parsedRelation.error}
            hint="支持 =、≤、≥；方程会自动选择有界的一侧。可用 x、y、z、sqrt、abs、sin、exp、log 等。"
            multiline
            trailing={<span className="mode-chip">MARCHING CUBES</span>}
          />

          <div className="preset-row">
            <span className="preset-label">快速示例</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="preset-chip"
                onClick={() => setEquation(preset.expression)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
          >
            <span>采样设置</span>
            <span className="advanced-summary">
              {resolution}³ · [{domainMin.x}, {domainMax.x}]
            </span>
            <ChevronDown
              size={14}
              strokeWidth={1.8}
              className={`advanced-chevron ${advancedOpen ? 'is-open' : ''}`}
            />
          </button>

          {advancedOpen ? (
            <div className="advanced-panel">
              <div className="form-block">
                <div className="form-block-label">采样范围 · 最小边界</div>
                <div className="axis-grid">
                  <AxisField axis="x" value={domainMin.x} onChange={(value) => setDomainMin((current) => ({ ...current, x: value }))} />
                  <AxisField axis="y" value={domainMin.y} onChange={(value) => setDomainMin((current) => ({ ...current, y: value }))} />
                  <AxisField axis="z" value={domainMin.z} onChange={(value) => setDomainMin((current) => ({ ...current, z: value }))} />
                </div>
              </div>
              <div className="form-block">
                <div className="form-block-label">采样范围 · 最大边界</div>
                <div className="axis-grid">
                  <AxisField axis="x" value={domainMax.x} onChange={(value) => setDomainMax((current) => ({ ...current, x: value }))} />
                  <AxisField axis="y" value={domainMax.y} onChange={(value) => setDomainMax((current) => ({ ...current, y: value }))} />
                  <AxisField axis="z" value={domainMax.z} onChange={(value) => setDomainMax((current) => ({ ...current, z: value }))} />
                </div>
              </div>
              <div className="field">
                <span className="field-label">采样精度</span>
                <SelectField
                  value={resolution}
                  onValueChange={setResolution}
                  options={RESOLUTION_OPTIONS}
                  ariaLabel="采样精度"
                />
              </div>
              <p className="advanced-note">
                精度越高，曲面越平滑，但 Web Worker 计算时间与三角面数量会明显增加。
                建议先使用 32³ 调整方程，再提高精度。
              </p>
            </div>
          ) : null}

          <div className="implicit-status">
            <span className="status-dot" />
            <span>
              {parsedRelation.relation?.comparator === '='
                ? '封闭方程 · 系统自动选择有界一侧'
                : '不等式实体 · 将保留满足条件的一侧'}
            </span>
          </div>

          {implicitHint ? <div className="success-note">{implicitHint}</div> : null}
          {formError ? (
            <div className="form-error">
              <AlertTriangle size={13} strokeWidth={2} />
              <span>{formError}</span>
            </div>
          ) : null}

          <button type="submit" className="primary-button add-button" disabled={busyGenerating}>
            {busyGenerating ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Sparkles size={15} strokeWidth={2} />
            )}
            生成方程实体
            <span className="button-tail">MCA</span>
          </button>
          <p className="form-note">
            离散化为封闭三角网格后加入场景。单叶双曲面、平面等无界曲面会被拒绝。
          </p>
        </form>
      )}
    </section>
  );
}
