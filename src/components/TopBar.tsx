import { useState } from 'react';
import { HelpCircle, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { formatCount } from '../lib/utils';
import { BrandMark } from './BrandMark';
import { Modal, TooltipButton } from './ui';

export function TopBar({ onOpenGuide }: { onOpenGuide: () => void }) {
  const objects = useStudioStore((state) => state.objects);
  const projections = useStudioStore((state) => state.projections);
  const loadDemo = useStudioStore((state) => state.loadDemo);
  const clearScene = useStudioStore((state) => state.clearScene);
  const pushToast = useStudioStore((state) => state.pushToast);
  const [resetOpen, setResetOpen] = useState(false);

  const totalTriangles = objects.reduce((sum, object) => sum + object.triangleCount, 0);

  const restoreDemo = () => {
    setResetOpen(false);
    loadDemo();
    pushToast({
      variant: 'success',
      title: '示例场景已恢复',
      description: '球体 A 与圆柱体 B 已重新载入，可直接体验布尔运算。',
    });
  };

  const resetScene = () => {
    setResetOpen(false);
    clearScene();
    pushToast({
      variant: 'info',
      title: '场景已清空',
      description: '所有几何体与投影已移除，显存资源已释放。',
    });
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div className="brand-copy">
            <div className="brand-line">
              <h1>剖物</h1>
              <span className="brand-tag">GEOMETRY LAB</span>
              <span className="brand-version">v1.0</span>
            </div>
            <p className="brand-subtitle">立体切割与三视图投影实验台</p>
          </div>
        </div>

        <div className="topbar-center">
          <div className="topbar-stat">
            <span className="stat-label">SOLIDS</span>
            <strong>{String(objects.length).padStart(2, '0')}</strong>
          </div>
          <span className="topbar-divider" />
          <div className="topbar-stat">
            <span className="stat-label">TRIANGLES</span>
            <strong>{formatCount(totalTriangles)}</strong>
          </div>
          <span className="topbar-divider" />
          <div className="topbar-stat">
            <span className="stat-label">PROJECTIONS</span>
            <strong>{String(projections.length).padStart(2, '0')}</strong>
          </div>
          <div className="engine-pill">
            <span className="engine-dot" />
            three-bvh-csg
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="ghost-button topbar-action"
            onClick={restoreDemo}
            title="恢复示例场景"
          >
            <Sparkles size={14} strokeWidth={1.8} />
            <span className="action-label">示例</span>
          </button>
          <TooltipButton label="重置场景" onClick={() => setResetOpen(true)}>
            <RotateCcw size={16} strokeWidth={1.8} />
          </TooltipButton>
          <TooltipButton label="使用指南" onClick={onOpenGuide}>
            <HelpCircle size={16} strokeWidth={1.8} />
          </TooltipButton>
        </div>
      </header>

      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="重置当前场景？"
        kicker="RESET / 清理几何与显存"
        footer={
          <>
            <button type="button" className="secondary-button" onClick={() => setResetOpen(false)}>
              取消
            </button>
            <button type="button" className="danger-button" onClick={resetScene}>
              <Trash2 size={14} strokeWidth={1.9} />
              清空场景
            </button>
          </>
        }
      >
        <p className="dialog-paragraph">
          当前场景的 {objects.length} 个对象和 {projections.length} 个投影图层将被移除，
          相关 BufferGeometry 会同步 <code>dispose()</code>。此操作不可撤销。
        </p>
        <button type="button" className="inline-link" onClick={restoreDemo}>
          或者恢复初始示例场景 →
        </button>
      </Modal>
    </>
  );
}
