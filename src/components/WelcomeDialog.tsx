import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ArrowRight,
  Combine,
  Crosshair,
  ScanLine,
  Scissors,
  ShieldCheck,
  Sigma,
  Sparkles,
  X,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import {
  createProjectionGeometry,
  getGeometryStats,
} from '../lib/geometry';
import { useStudioStore } from '../store/useStudioStore';

type QuickStart = 'csg' | 'equation' | 'clip' | 'projection';

const QUICK_STARTS: Array<{
  id: QuickStart;
  icon: typeof Combine;
  title: string;
  kicker: string;
  copy: string;
}> = [
  {
    id: 'csg',
    icon: Combine,
    title: '布尔切割',
    kicker: 'CSG / BOOLEAN',
    copy: '用对象 B 切掉对象 A 的一部分，完成后可继续选中结果。',
  },
  {
    id: 'equation',
    icon: Sigma,
    title: '方程成体',
    kicker: 'IMPLICIT / MC',
    copy: '输入数学不等式，自动提取封闭网格，并检查水密性。',
  },
  {
    id: 'clip',
    icon: Scissors,
    title: '平面剖切',
    kicker: 'CLIPPING / PLANE',
    copy: '用半透明平面实时切开实体，观察内部结构。',
  },
  {
    id: 'projection',
    icon: ScanLine,
    title: '三视图',
    kicker: 'ORTHOGRAPHIC',
    copy: '把结果压平到 XOY / YOZ / XOZ，比较二维轮廓。',
  },
];

function scrollToWorkspacePanel(panel: 'left' | 'right'): void {
  if (typeof window === 'undefined') return;
  if (!window.matchMedia('(max-width: 1120px)').matches) return;
  window.setTimeout(() => {
    const selector = panel === 'left' ? '.left-panel' : '.right-panel';
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

export function WelcomeDialog({
  open,
  onOpenChange,
  onOpenGuide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenGuide: () => void;
}) {
  const start = (quickStart: QuickStart) => {
    onOpenChange(false);
    const store = useStudioStore.getState();

    if (quickStart === 'csg') {
      store.loadDemo();
      store.setRightTab('boolean');
      store.requestCamera('iso');
      store.pushToast({
        variant: 'info',
        title: '布尔示例已准备好',
        description: '右侧 A 与 B 已选中，点击“执行差集”就能看到切割结果。',
      });
      scrollToWorkspacePanel('right');
      return;
    }

    if (quickStart === 'equation') {
      store.setCreationMode('implicit');
      store.pushToast({
        variant: 'info',
        title: '已切换到方程创建',
        description: '左侧已载入示例方程，点击“生成方程实体”即可得到封闭曲面。',
      });
      scrollToWorkspacePanel('left');
      return;
    }

    if (quickStart === 'clip') {
      store.loadDemo();
      store.setClipEquation('z = 2');
      store.setClipKeepSide('positive');
      store.setShowClipHelper(true);
      store.setClipEnabled(true);
      store.setRightTab('clip');
      store.requestCamera('iso');
      store.pushToast({
        variant: 'info',
        title: '视觉剖切已开启',
        description: '当前平面为 z = 2，可继续在右侧调整方程或保留侧。',
      });
      scrollToWorkspacePanel('right');
      return;
    }

    store.loadDemo();
    const state = useStudioStore.getState();
    const first = state.objects[0];
    if (first) {
      try {
        const geometry = createProjectionGeometry(first.geometry, 'XOY');
        const stats = getGeometryStats(geometry);
        state.addProjection({
          sourceObjectId: first.id,
          plane: 'XOY',
          geometry,
          triangleCount: stats.triangleCount,
          vertexCount: stats.vertexCount,
        });
        state.pushToast({
          variant: 'success',
          title: '已生成 XOY 投影',
          description: '右侧可以继续添加 YOZ / XOZ，或调整投影不透明度。',
        });
      } catch (error) {
        state.pushToast({
          variant: 'error',
          title: '投影生成失败',
          description: error instanceof Error ? error.message : '未知错误',
        });
      }
    }
    store.setRightTab('projection');
    store.requestCamera('iso');
    scrollToWorkspacePanel('right');
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="welcome-overlay" />
        <DialogPrimitive.Content className="welcome-dialog">
          <div className="welcome-background-grid" aria-hidden />
          <div className="welcome-glow welcome-glow-a" aria-hidden />
          <div className="welcome-glow welcome-glow-b" aria-hidden />
          <div className="welcome-topline">
            <div className="welcome-brand">
              <BrandMark className="welcome-brand-mark" />
              <div>
                <span className="welcome-brand-name">剖物</span>
                <span className="welcome-brand-en">GEOMETRY LAB</span>
              </div>
            </div>
            <span className="welcome-top-tag">WEBGL · 无需安装 · 本地计算</span>
            <DialogPrimitive.Close className="welcome-close" aria-label="关闭新手引导">
              <X size={16} strokeWidth={1.8} />
            </DialogPrimitive.Close>
          </div>

          <div className="welcome-content">
            <div className="welcome-hero">
              <div className="welcome-kicker">
                <span className="welcome-kicker-line" />
                A PLAYGROUND FOR SOLID GEOMETRY
              </div>
              <DialogPrimitive.Title className="welcome-title">
                把立体几何，
                <br />
                <em>切开给你看。</em>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="welcome-description">
                不用安装软件，也不用注册。用平面剖开一个实体，让两个立体做布尔运算，
                再把结果压平成三视图。所有计算都在你的浏览器里完成。
              </DialogPrimitive.Description>

              <div className="welcome-feature-chips">
                <span><ShieldCheck size={12} />数据不上传</span>
                <span><Sparkles size={12} />Web Worker 计算</span>
                <span><Crosshair size={12} />精确到三角面</span>
              </div>

              <div className="welcome-actions">
                <DialogPrimitive.Close className="primary-button welcome-start-button">
                  进入实验台
                  <ArrowRight size={14} strokeWidth={2} />
                </DialogPrimitive.Close>
                <button
                  type="button"
                  className="welcome-guide-button"
                  onClick={onOpenGuide}
                >
                  查看使用指南
                </button>
              </div>

              <p className="welcome-privacy">
                <ShieldCheck size={12} strokeWidth={1.8} />
                几何、方程与运算全部留在你的设备上，不会上传到服务器。
              </p>
            </div>

            <div className="welcome-quick">
              <div className="welcome-quick-heading">
                <span>从这里开始</span>
                <span>QUICK START</span>
              </div>
              <div className="welcome-quick-grid">
                {QUICK_STARTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="welcome-quick-card"
                      onClick={() => start(item.id)}
                    >
                      <span className="welcome-quick-icon">
                        <Icon size={17} strokeWidth={1.7} />
                      </span>
                      <span className="welcome-quick-kicker">{item.kicker}</span>
                      <span className="welcome-quick-title">{item.title}</span>
                      <span className="welcome-quick-copy">{item.copy}</span>
                      <span className="welcome-quick-arrow">
                        <ArrowRight size={13} strokeWidth={1.8} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="welcome-footnote">
                <span className="welcome-footnote-mark">01</span>
                <span>选择任意卡片，进入对应的实验场景；随时可以从右上角“使用指南”重新查看。</span>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
