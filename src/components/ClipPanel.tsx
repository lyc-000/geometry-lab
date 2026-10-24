import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Scissors, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import { useClipPlane } from '../hooks/useClipPlane';
import {
  createHalfSpaceGeometry,
  getGeometryStats,
} from '../lib/geometry';
import { runCsgInWorker, CsgWorkerError } from '../lib/csg-worker-client';
import { createBufferGeometryFromData } from '../lib/geometry';
import { delay } from '../lib/utils';
import { useStudioStore } from '../store/useStudioStore';
import {
  EquationField,
  Formula,
  SectionHeading,
  SegmentedControl,
  ToggleRow,
} from './ui';
import type { ClipKeepSide } from '../types';

const PLANE_PRESETS = ['z = 2', 'x + y = 2.5', 'x = 0', 'x + y + z = 3.5'];

export function ClipPanel() {
  const clipEquation = useStudioStore((state) => state.clipEquation);
  const setClipEquation = useStudioStore((state) => state.setClipEquation);
  const clipEnabled = useStudioStore((state) => state.clipEnabled);
  const setClipEnabled = useStudioStore((state) => state.setClipEnabled);
  const clipKeepSide = useStudioStore((state) => state.clipKeepSide);
  const setClipKeepSide = useStudioStore((state) => state.setClipKeepSide);
  const showClipHelper = useStudioStore((state) => state.showClipHelper);
  const setShowClipHelper = useStudioStore((state) => state.setShowClipHelper);
  const selectedId = useStudioStore((state) => state.selectedId);
  const objects = useStudioStore((state) => state.objects);
  const replaceWithResult = useStudioStore((state) => state.replaceWithResult);
  const pushToast = useStudioStore((state) => state.pushToast);
  const beginBusy = useStudioStore((state) => state.beginBusy);
  const endBusy = useStudioStore((state) => state.endBusy);

  const clip = useClipPlane();
  const [busySolidify, setBusySolidify] = useState(false);
  const selected = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );

  const canSolidify =
    Boolean(selected) &&
    Boolean(clip.parsed) &&
    Boolean(clip.plane) &&
    Boolean(clip.point) &&
    !busySolidify;

  const handleEnable = (enabled: boolean) => {
    if (enabled && !clip.plane) {
      pushToast({
        variant: 'error',
        title: '无法启用视觉裁剪',
        description: clip.error ?? '请先输入有效的线性平面方程。',
      });
      return;
    }
    setClipEnabled(enabled);
    if (enabled) setShowClipHelper(true);
  };

  const handleSolidify = async () => {
    if (!selected) {
      pushToast({
        variant: 'info',
        title: '请先选中一个对象',
        description: '在对象列表或视口中点击需要剖切的实体。',
      });
      return;
    }
    if (!clip.parsed || !clip.plane || !clip.point) {
      pushToast({
        variant: 'error',
        title: '平面方程无效',
        description: clip.error ?? '请输入线性平面方程。',
      });
      return;
    }

    const plane = clip.plane;
    const point = clip.point;
    const geometry = selected.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) {
      pushToast({ variant: 'error', title: '无法读取对象包围盒' });
      return;
    }

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];
    const distances = corners.map((corner) => plane.distanceToPoint(corner));
    const allKept = distances.every((distance) => distance > 1e-5);
    const allRemoved = distances.every((distance) => distance < -1e-5);

    if (allKept) {
      pushToast({
        variant: 'info',
        title: '平面没有穿过所选对象',
        description: '请调整平面方程或保留侧，确保剖切平面与实体相交。',
      });
      return;
    }
    if (allRemoved) {
      pushToast({
        variant: 'error',
        title: '对象会完全被切除',
        description: '切换“保留侧”或调整平面位置后再试。',
      });
      return;
    }

    setBusySolidify(true);
    beginBusy({
      title: '正在固化剖切',
      detail: `对对象 ${selected.name} 执行半空间交集 · three-bvh-csg`,
    });
    const startedAt = Date.now();
    const halfSpaceSize = Math.max(120, (geometry.boundingSphere?.radius ?? 20) * 6);
    const halfSpace = createHalfSpaceGeometry(
      [plane.normal.x, plane.normal.y, plane.normal.z],
      [point.x, point.y, point.z],
      halfSpaceSize,
    );

    try {
      const payload = await runCsgInWorker({
        operation: 'intersect',
        a: selected.geometry,
        b: halfSpace,
      });

      const geometryOut = createBufferGeometryFromData(
        payload.positions,
        payload.normals,
        payload.indices,
      );
      const stats = getGeometryStats(geometryOut);
      const created = replaceWithResult([selected.id], {
        label: '剖切体',
        kind: 'clip',
        geometry: geometryOut,
        triangleCount: stats.triangleCount,
        vertexCount: stats.vertexCount,
        meta: {
          sourceName: selected.name,
          equation: clip.parsed.source,
          latex: clip.parsed.latex,
          params: {
            plane: clip.parsed.displayEquation,
            keepSide: clip.keepSide === 'positive' ? '正侧' : '负侧',
          },
        },
      });

      if (created) {
        setClipEnabled(false);
        setShowClipHelper(false);
        pushToast({
          variant: 'success',
          title: `剖切实体 ${created.name} 已生成`,
          description: `原对象 ${selected.name} 已被替换，视觉裁剪已关闭。`,
        });
      }
    } catch (error) {
      const message =
        error instanceof CsgWorkerError
          ? error.message
          : error instanceof Error
            ? error.message
            : '固化剖切失败。';
      pushToast({
        variant: 'error',
        title: '无法生成剖切实体',
        description: message,
        duration: 7600,
      });
    } finally {
      halfSpace.dispose();
      const minimum = 650;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimum) await delay(minimum - elapsed);
      setBusySolidify(false);
      endBusy();
    }
  };

  return (
    <section className="panel-section">
      <SectionHeading
        index="01"
        title="平面剖切"
        kicker="CLIPPING PLANES"
        trailing={<span className={`live-pill ${clipEnabled && clip.plane ? 'is-live' : ''}`}><span />{clipEnabled && clip.plane ? 'LIVE' : 'STANDBY'}</span>}
      />

      <p className="panel-intro">
        输入一个线性平面，实时裁去一侧以观察内部结构。裁剪仅作用于 GPU 渲染，
        不改变几何数据；若需参与投影或 CSG，请使用下方的“固化”操作。
      </p>

      <EquationField
        label="平面方程"
        value={clipEquation}
        onChange={setClipEquation}
        placeholder="x + y + z = 6"
        previewLatex={clip.parsed?.latex}
        error={clip.error}
        hint="只支持 x、y、z 的一次方程，例如 z = 2 或 2x − y + 3z = 4。"
        trailing={
          <span className="mode-chip">
            <span className="mode-dot" />
            PLANE
          </span>
        }
      />

      <div className="preset-row">
        <span className="preset-label">常用平面</span>
        {PLANE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`preset-chip ${clipEquation === preset ? 'is-active' : ''}`}
            onClick={() => setClipEquation(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="clip-summary">
        <div className="clip-summary-row">
          <span>KEPT SIDE</span>
          <strong>{clip.keepSide === 'positive' ? '方程正侧' : '方程负侧'}</strong>
        </div>
        <div className="clip-summary-row">
          <span>KEPT NORMAL</span>
          <strong className="mono">
            {clip.normal
              ? `(${clip.normal.toArray().map((value) => value.toFixed(2)).join(', ')})`
              : '—'}
          </strong>
        </div>
        <div className="clip-summary-formula">
          <Formula latex="\mathbf{n}\cdot\mathbf{p}+c \ge 0" />
          <span>法向指向保留侧</span>
        </div>
      </div>

      <div className="form-block keep-side-block">
        <div className="form-block-label">保留侧</div>
        <SegmentedControl<ClipKeepSide>
          value={clipKeepSide}
          onChange={setClipKeepSide}
          options={[
            { value: 'positive', label: '保留正侧' },
            { value: 'negative', label: '保留负侧' },
          ]}
          ariaLabel="保留侧"
          className="segmented-compact"
        />
      </div>

      <div className="switch-stack">
        <ToggleRow
          checked={clipEnabled && Boolean(clip.plane)}
          onCheckedChange={handleEnable}
          label="启用视觉裁剪"
          description="ClippingPlanes 会实时裁去保留侧以外的部分"
        />
        <ToggleRow
          checked={showClipHelper}
          onCheckedChange={setShowClipHelper}
          label="显示辅助平面"
          description="半透明平面、边界与法向箭头"
        />
      </div>

      <div className="panel-subsection">
        <div className="subsection-heading">
          <span>固化剖切</span>
          <span className="subsection-code">BAKE CSG</span>
        </div>
        <p className="subsection-copy">
          将当前平面转换为真实半空间，与选中实体做布尔交集；结果会成为可继续参与
          CSG / 投影的新实体，原对象被替换。
        </p>
        <div className="current-target">
          <span className="target-label">当前对象</span>
          <span className="target-name">
            {selected ? `${selected.name} · ${selected.label}` : '未选中'}
          </span>
          {selected ? <span className="target-faces">{selected.triangleCount.toLocaleString('zh-CN')} 面</span> : null}
        </div>
        <button
          type="button"
          className="secondary-button full-button"
          onClick={handleSolidify}
          disabled={!canSolidify}
        >
          {busySolidify ? <Loader2 size={14} className="spin" /> : <Scissors size={14} strokeWidth={1.9} />}
          生成剖切实体
          <ArrowRight size={13} strokeWidth={1.8} className="button-arrow" />
        </button>
        <p className="form-note">
          视觉裁剪开启时，“固化”仍以当前平面为界生成封闭几何体；完成后视觉裁剪会自动关闭。
        </p>
      </div>

      {clip.error ? (
        <div className="form-error compact">
          <AlertTriangle size={13} strokeWidth={2} />
          <span>{clip.error}</span>
        </div>
      ) : null}
      <div className="worker-note">
        <Sparkles size={12} strokeWidth={1.8} />
        <span>平面参数实时更新，无 GPU / CPU 副本残留。</span>
      </div>
    </section>
  );
}
