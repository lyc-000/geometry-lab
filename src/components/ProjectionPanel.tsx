import { useMemo, type CSSProperties } from 'react';
import {
  Eye,
  EyeOff,
  Layers,
  MousePointer2,
  ScanLine,
  Trash2,
} from 'lucide-react';
import {
  createProjectionGeometry,
  getGeometryStats,
} from '../lib/geometry';
import { describeKind, formatCount } from '../lib/utils';
import { PROJECTION_COLORS } from '../lib/colors';
import { useStudioStore } from '../store/useStudioStore';
import type { ProjectionPlane } from '../types';
import {
  EmptyState,
  RangeSlider,
  SectionHeading,
} from './ui';

const PLANES: Array<{
  value: ProjectionPlane;
  title: string;
  planeLabel: string;
  normal: string;
  axes: [string, string];
  hint: string;
}> = [
  {
    value: 'XOY',
    title: 'XOY',
    planeLabel: 'Z = 0',
    normal: 'Z',
    axes: ['X', 'Y'],
    hint: '俯视投影',
  },
  {
    value: 'YOZ',
    title: 'YOZ',
    planeLabel: 'X = 0',
    normal: 'X',
    axes: ['Y', 'Z'],
    hint: '侧视投影',
  },
  {
    value: 'XOZ',
    title: 'XOZ',
    planeLabel: 'Y = 0',
    normal: 'Y',
    axes: ['X', 'Z'],
    hint: '正视投影',
  },
];

function ProjectionGlyph({ axes }: { axes: [string, string] }) {
  return (
    <svg viewBox="0 0 44 38" className="projection-glyph" aria-hidden>
      <path d="M7 31H38M7 31V6" stroke="currentColor" strokeOpacity=".58" strokeWidth="1.1" />
      <path
        d="M13 25 30 17l7 5-17 8-7-5Z"
        fill="currentColor"
        fillOpacity=".15"
        stroke="currentColor"
        strokeOpacity=".8"
        strokeWidth="1.1"
      />
      <text x="39" y="35" fill="currentColor" fillOpacity=".7" fontSize="7" fontFamily="monospace">
        {axes[0]}
      </text>
      <text x="2.5" y="9" fill="currentColor" fillOpacity=".7" fontSize="7" fontFamily="monospace">
        {axes[1]}
      </text>
      <circle cx="34.5" cy="9" r="1.6" fill="currentColor" fillOpacity=".55" />
    </svg>
  );
}

export function ProjectionPanel() {
  const objects = useStudioStore((state) => state.objects);
  const selectedId = useStudioStore((state) => state.selectedId);
  const projections = useStudioStore((state) => state.projections);
  const opacity = useStudioStore((state) => state.projectionOpacity);
  const setOpacity = useStudioStore((state) => state.setProjectionOpacity);
  const addProjection = useStudioStore((state) => state.addProjection);
  const removeProjection = useStudioStore((state) => state.removeProjection);
  const toggleProjectionVisibility = useStudioStore((state) => state.toggleProjectionVisibility);
  const pushToast = useStudioStore((state) => state.pushToast);

  const selected = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );

  const project = (plane: ProjectionPlane, title: string) => {
    if (!selected) {
      pushToast({
        variant: 'info',
        title: '请先选中一个对象',
        description: '在对象列表或视口中点击实体后再生成投影。',
      });
      return;
    }

    try {
      const existing = projections.some(
        (layer) => layer.sourceObjectId === selected.id && layer.plane === plane,
      );
      const geometry = createProjectionGeometry(selected.geometry, plane);
      const stats = getGeometryStats(geometry);
      const layer = addProjection({
        sourceObjectId: selected.id,
        plane,
        geometry,
        triangleCount: stats.triangleCount,
        vertexCount: stats.vertexCount,
      });

      if (!layer) {
        geometry.dispose();
        throw new Error('无法关联源对象。');
      }

      pushToast({
        variant: 'success',
        title: `${selected.name} → ${title} 投影${existing ? '已更新' : '已生成'}`,
        description: `沿 ${PLANES.find((item) => item.value === plane)?.normal} 轴压平 · ${formatCount(stats.triangleCount)} 个三角面`,
      });
    } catch (error) {
      pushToast({
        variant: 'error',
        title: '投影生成失败',
        description: error instanceof Error ? error.message : '无法生成投影几何体。',
      });
    }
  };

  const clearAll = () => {
    useStudioStore.getState().clearProjections();
    pushToast({
      variant: 'info',
      title: '投影图层已清空',
      description: '对应的扁平几何体已从显存释放。',
    });
  };

  return (
    <section className="panel-section">
      <SectionHeading
        index="03"
        title="三视图投影"
        kicker="ORTHOGRAPHIC / FLATTEN"
        trailing={<span className="count-pill">{String(projections.length).padStart(2, '0')}</span>}
      />

      <p className="panel-intro">
        选中任意实体，将其顶点沿指定轴压到坐标 0，生成半透明扁平几何体。
        投影与源实体共用世界坐标，可用于比较切割前后的二维轮廓。
      </p>

      {selected ? (
        <div className="projection-source">
          <div
            className="source-avatar"
            style={{
              color: selected.color,
              borderColor: `${selected.color}55`,
              background: `${selected.color}17`,
            }}
          >
            {selected.name}
          </div>
          <div className="source-copy">
            <span className="source-kicker">CURRENT SELECTION</span>
            <strong>{describeKind(selected.kind, selected.meta)}</strong>
            <span className="source-meta">
              {selected.label} · {formatCount(selected.triangleCount)} 面
              {!selected.visible ? ' · 已隐藏' : ''}
            </span>
          </div>
          <span className="source-live"><span />SELECTED</span>
        </div>
      ) : (
        <EmptyState
          icon={<MousePointer2 size={22} strokeWidth={1.5} />}
          title="先选中一个对象"
          description="可以在场景中直接点击实体，或点击左侧对象列表。"
        />
      )}

      <div className="projection-grid" role="group" aria-label="投影平面">
        {PLANES.map((plane) => {
          const active = selected
            ? projections.some(
                (layer) => layer.sourceObjectId === selected.id && layer.plane === plane.value,
              )
            : false;
          return (
            <button
              key={plane.value}
              type="button"
              className={`projection-button ${active ? 'is-active' : ''}`}
              onClick={() => project(plane.value, plane.title)}
              disabled={!selected}
              style={{ '--plane-color': PROJECTION_COLORS[plane.value] } as CSSProperties}
            >
              <span className="projection-topline">
                <span className="projection-name">{plane.title}</span>
                {active ? <span className="projection-check">●</span> : null}
              </span>
              <ProjectionGlyph axes={plane.axes} />
              <span className="projection-plane-label">{plane.planeLabel}</span>
              <span className="projection-hint">{plane.hint}</span>
            </button>
          );
        })}
      </div>

      <p className="projection-formula-note">
        压平规则：XOY → <code>z = 0</code> · YOZ → <code>x = 0</code> · XOZ → <code>y = 0</code>
      </p>

      {projections.length > 0 ? (
        <div className="opacity-control">
          <div className="opacity-heading">
            <span>投影不透明度</span>
            <strong>{Math.round(opacity * 100)}%</strong>
          </div>
          <RangeSlider
            value={opacity}
            onValueChange={setOpacity}
            min={0.08}
            max={0.9}
            step={0.01}
            ariaLabel="投影不透明度"
          />
        </div>
      ) : null}

      <div className="projection-list-header">
        <span>投影图层</span>
        {projections.length > 0 ? (
          <button type="button" className="text-button" onClick={clearAll}>
            全部清除
          </button>
        ) : (
          <span className="list-muted">暂无图层</span>
        )}
      </div>

      {projections.length === 0 ? (
        <div className="projection-empty-row">
          <ScanLine size={15} strokeWidth={1.7} />
          <span>选择平面即可生成第一个三视图投影。</span>
        </div>
      ) : (
        <div className="projection-list">
          {projections.map((layer) => (
            <div
              key={layer.id}
              className={`projection-row ${!layer.visible ? 'is-hidden' : ''}`}
            >
              <span
                className="projection-swatch"
                style={{ backgroundColor: layer.color }}
              />
              <div className="projection-copy">
                <span className="projection-row-title">
                  {layer.sourceName} · {layer.plane}
                  <span className="projection-plane-chip">
                    {PLANES.find((plane) => plane.value === layer.plane)?.planeLabel}
                  </span>
                </span>
                <span className="projection-row-meta">
                  {layer.sourceLabel} · {formatCount(layer.triangleCount)} 面
                </span>
              </div>
              <div className="projection-actions">
                <button
                  type="button"
                  className="row-icon-button"
                  title={layer.visible ? '隐藏投影' : '显示投影'}
                  aria-label={layer.visible ? '隐藏投影' : '显示投影'}
                  onClick={() => toggleProjectionVisibility(layer.id)}
                >
                  {layer.visible ? (
                    <Eye size={13} strokeWidth={1.7} />
                  ) : (
                    <EyeOff size={13} strokeWidth={1.7} />
                  )}
                </button>
                <button
                  type="button"
                  className="row-icon-button is-danger"
                  title="删除投影并释放 geometry"
                  aria-label="删除投影"
                  onClick={() => {
                    removeProjection(layer.id);
                    pushToast({
                      variant: 'info',
                      title: `投影 ${layer.sourceName} · ${layer.plane} 已删除`,
                      description: '扁平的 BufferGeometry 已释放。',
                    });
                  }}
                >
                  <Trash2 size={13} strokeWidth={1.7} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="projection-footnote">
        <Layers size={13} strokeWidth={1.8} />
        投影几何体是独立的 BufferGeometry，不会随源对象实时变形；源对象被删除时会一并释放。
      </div>
    </section>
  );
}
