import { Eye, EyeOff, Layers, Trash2 } from 'lucide-react';
import { describeKind, formatCount, objectCategory } from '../lib/utils';
import { useStudioStore } from '../store/useStudioStore';
import { SectionHeading } from './ui';

export function ObjectList() {
  const objects = useStudioStore((state) => state.objects);
  const selectedId = useStudioStore((state) => state.selectedId);
  const hoveredId = useStudioStore((state) => state.hoveredId);
  const selectObject = useStudioStore((state) => state.selectObject);
  const setHovered = useStudioStore((state) => state.setHovered);
  const toggleVisibility = useStudioStore((state) => state.toggleVisibility);
  const removeObject = useStudioStore((state) => state.removeObject);
  const pushToast = useStudioStore((state) => state.pushToast);

  const onRemove = (id: string, name: string) => {
    removeObject(id);
    pushToast({
      variant: 'info',
      title: `对象 ${name} 已移除`,
      description: '对应的 BufferGeometry 与投影图层已释放。',
    });
  };

  return (
    <section className="panel-section object-section">
      <SectionHeading
        index="02"
        title="场景对象"
        kicker="SCENE / OBJECTS"
        trailing={<span className="count-pill">{String(objects.length).padStart(2, '0')}</span>}
      />

      {objects.length === 0 ? (
        <div className="object-empty">
          <Layers size={20} strokeWidth={1.5} />
          <p>场景还是空的</p>
          <span>从上方创建一个几何体，或点击顶部“示例”恢复演示。</span>
        </div>
      ) : (
        <div className="object-list">
          {objects.map((object, index) => {
            const isSelected = object.id === selectedId;
            const isHovered = object.id === hoveredId;
            return (
              <div
                key={object.id}
                className={`object-row ${isSelected ? 'is-selected' : ''} ${!object.visible ? 'is-hidden' : ''} ${isHovered ? 'is-hovered' : ''}`}
              >
                <button
                  type="button"
                  className="object-main"
                  onClick={() => selectObject(object.id)}
                  onMouseEnter={() => setHovered(object.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span
                    className="object-avatar"
                    style={{
                      color: object.color,
                      borderColor: `${object.color}55`,
                      background: `${object.color}17`,
                    }}
                  >
                    {object.name}
                  </span>
                  <span className="object-copy">
                    <span className="object-title-line">
                      <span className="object-title">{describeKind(object.kind, object.meta)}</span>
                      {!object.visible ? <span className="hidden-tag">隐藏</span> : null}
                    </span>
                    <span className="object-meta">
                      <span>{objectCategory(object.kind)}</span>
                      <span className="meta-dot" />
                      <span>{formatCount(object.triangleCount)} 面</span>
                      <span className="object-index">#{String(index + 1).padStart(2, '0')}</span>
                    </span>
                  </span>
                </button>
                <div className="object-actions">
                  <button
                    type="button"
                    className="row-icon-button"
                    title={object.visible ? '隐藏对象' : '显示对象'}
                    aria-label={object.visible ? '隐藏对象' : '显示对象'}
                    onClick={() => toggleVisibility(object.id)}
                  >
                    {object.visible ? (
                      <Eye size={14} strokeWidth={1.7} />
                    ) : (
                      <EyeOff size={14} strokeWidth={1.7} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="row-icon-button is-danger"
                    title="删除对象并释放 geometry"
                    aria-label={`删除对象 ${object.name}`}
                    onClick={() => onRemove(object.id, object.name)}
                  >
                    <Trash2 size={14} strokeWidth={1.7} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {objects.length > 0 ? (
        <p className="list-footnote">
          点击列表或视口中的实体进行选中。删除对象会同时释放其几何体与投影。
        </p>
      ) : null}
    </section>
  );
}
