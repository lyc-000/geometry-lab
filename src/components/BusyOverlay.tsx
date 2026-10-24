import { Loader2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';

export function BusyOverlay() {
  const busy = useStudioStore((state) => state.busy);

  if (!busy) return null;

  return (
    <div className="busy-overlay" role="status" aria-live="assertive">
      <div className="busy-card">
        <div className="busy-spinner" aria-hidden>
          <span className="busy-ring busy-ring-a" />
          <span className="busy-ring busy-ring-b" />
          <Loader2 size={22} strokeWidth={1.6} />
        </div>
        <div className="busy-copy">
          <div className="busy-kicker">
            <span className="busy-pulse" />
            COMPUTING · WEB WORKER
          </div>
          <h3 className="busy-title">{busy.title}</h3>
          <p className="busy-detail">
            {busy.detail ?? '正在处理几何数据，请稍候。'}
          </p>
          <div className="busy-progress" aria-hidden>
            <span />
          </div>
          <p className="busy-footnote">运算期间已锁定所有编辑操作，完成后自动恢复。</p>
        </div>
      </div>
    </div>
  );
}
