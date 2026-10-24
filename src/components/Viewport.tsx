import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  AlertTriangle,
  Box,
  Camera,
  Crosshair,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { describeKind, formatCount } from '../lib/utils';
import { captureSceneToPng } from '../lib/snapshot';
import { useStudioStore } from '../store/useStudioStore';
import type { CameraPreset } from '../types';
import { SceneCanvas } from './SceneCanvas';
import { TooltipButton } from './ui';

const CAMERA_OPTIONS: Array<{ value: CameraPreset; label: string; title: string }> = [
  { value: 'iso', label: 'ISO', title: '等轴测视图' },
  { value: 'front', label: '前视', title: '前视 · XOY 方向' },
  { value: 'side', label: '侧视', title: '侧视 · YOZ 方向' },
  { value: 'top', label: '俯视', title: '俯视 · 从 Z 轴向下' },
];

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[scene]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="scene-fallback">
          <div className="scene-fallback-icon">
            <AlertTriangle size={22} strokeWidth={1.7} />
          </div>
          <h3>3D 渲染初始化失败</h3>
          <p>
            浏览器可能没有可用的 WebGL 2 上下文，或显卡驱动拒绝了渲染请求。
            请开启硬件加速后刷新页面。
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={14} strokeWidth={1.8} />
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Viewport() {
  const objects = useStudioStore((state) => state.objects);
  const selectedId = useStudioStore((state) => state.selectedId);
  const clipEnabled = useStudioStore((state) => state.clipEnabled);
  const clipEquation = useStudioStore((state) => state.clipEquation);
  const overlapPreview = useStudioStore((state) => state.overlapPreview);
  const cameraPreset = useStudioStore((state) => state.cameraPreset);
  const requestCamera = useStudioStore((state) => state.requestCamera);
  const requestFit = useStudioStore((state) => state.requestFit);
  const loadDemo = useStudioStore((state) => state.loadDemo);
  const pushToast = useStudioStore((state) => state.pushToast);

  const selected = objects.find((object) => object.id === selectedId) ?? null;

  const loadExample = () => {
    loadDemo();
    requestCamera('iso');
    pushToast({
      variant: 'success',
      title: '示例场景已加载',
      description: '可以点击右侧“布尔”立即执行 A − B。',
    });
  };

  const saveSnapshot = () => {
    try {
      const saved = captureSceneToPng();
      pushToast({
        variant: saved ? 'success' : 'error',
        title: saved ? '场景快照已保存' : '场景尚未准备好',
        description: saved
          ? '已导出当前 3D 画面为 PNG 图片。'
          : '3D 场景还没有完成初始化，请稍后再试。',
      });
    } catch (error) {
      pushToast({
        variant: 'error',
        title: '快照导出失败',
        description: error instanceof Error ? error.message : '无法导出当前画面。',
      });
    }
  };

  return (
    <section
      className={`viewport ${clipEnabled ? 'has-clip' : ''} ${overlapPreview ? 'has-overlap' : ''}`}
      aria-label="三维场景"
    >
      <div className="viewport-backdrop" aria-hidden />
      <div className="canvas-layer">
        <SceneErrorBoundary>
          <SceneCanvas />
        </SceneErrorBoundary>
      </div>
      <div className="viewport-vignette" aria-hidden />
      <span className="viewport-corner corner-tl" aria-hidden />
      <span className="viewport-corner corner-tr" aria-hidden />
      <span className="viewport-corner corner-bl" aria-hidden />
      <span className="viewport-corner corner-br" aria-hidden />

      <div className="viewport-hud hud-top-left">
        <div className="hud-scene-row">
          <span className="scene-status"><span className="live-dot" />SCENE 01</span>
          <span className="hud-sep" />
          <span className="hud-mono">Z-UP · RIGHT-HANDED</span>
        </div>
        <div className="hud-scene-sub">
          <span>PERSPECTIVE</span>
          <span className="hud-sep" />
          <span>{String(objects.length).padStart(2, '0')} SOLIDS</span>
        </div>
        {clipEnabled ? (
          <div className="hud-clip-badge" title={clipEquation}>
            <Scissors size={12} strokeWidth={2} />
            <span>视觉剖切</span>
            <span className="hud-clip-equation">{clipEquation}</span>
          </div>
        ) : null}
        {overlapPreview ? (
          <div className="hud-overlap-badge">
            <Crosshair size={12} strokeWidth={2} />
            <span>A ∩ B 重叠区高亮</span>
            <span className="hud-overlap-count">
              {overlapPreview.triangleCount.toLocaleString('zh-CN')} 面
            </span>
          </div>
        ) : null}
      </div>

      <div className="viewport-toolbar" role="group" aria-label="相机预设">
        <span className="camera-toolbar-label">VIEW</span>
        {CAMERA_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`camera-preset ${cameraPreset === option.value ? 'is-active' : ''}`}
            onClick={() => requestCamera(option.value)}
            title={option.title}
          >
            {option.label}
          </button>
        ))}
        <span className="camera-toolbar-divider" />
        <TooltipButton label="重置视角" onClick={() => requestCamera('iso')}>
          <RotateCcw size={14} strokeWidth={1.86} />
        </TooltipButton>
        <TooltipButton
          label="适配所有实体"
          onClick={() => {
            requestFit();
            pushToast({
              variant: 'info',
              title: '视角已适配场景',
              description: '相机已根据当前可见实体的包围球重新取景。',
            });
          }}
        >
          <Maximize2 size={14} strokeWidth={1.86} />
        </TooltipButton>
        <TooltipButton label="保存场景快照" onClick={saveSnapshot}>
          <Camera size={14} strokeWidth={1.86} />
        </TooltipButton>
      </div>

      {selected ? (
        <div className="selected-hud">
          <span className="selected-kicker">SELECTED</span>
          <span className="selected-dot" style={{ backgroundColor: selected.color }} />
          <span className="selected-name">{selected.name}</span>
          <span className="selected-divider" />
          <span className="selected-kind">{describeKind(selected.kind, selected.meta)}</span>
          <span className="selected-faces">{formatCount(selected.triangleCount)} 面</span>
        </div>
      ) : null}

      <div className="viewport-hint">
        <MousePointer2 size={13} strokeWidth={1.8} />
        <span>单击实体选中</span>
        <span className="hint-divider" />
        <span>左键旋转</span>
        <span className="hint-divider" />
        <span>右键平移</span>
        <span className="hint-divider" />
        <span>滚轮缩放</span>
      </div>

      {objects.length === 0 ? (
        <div className="viewport-empty">
          <div className="empty-orbit" aria-hidden>
            <span className="empty-orbit-ring" />
            <Box size={28} strokeWidth={1.2} />
          </div>
          <span className="empty-kicker">EMPTY SCENE</span>
          <h2>从一个几何体开始</h2>
          <p>在左侧选择球体、圆柱、长方体或输入隐式方程，构建你的第一个三维实体。</p>
          <button type="button" className="primary-button" onClick={loadExample}>
            <Sparkles size={14} strokeWidth={2} />
            加载示例场景
          </button>
        </div>
      ) : null}
    </section>
  );
}
