import { Combine, ScanLine, Scissors } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import type { RightTab } from '../types';
import { ClipPanel } from './ClipPanel';
import { CsgPanel } from './CsgPanel';
import { ProjectionPanel } from './ProjectionPanel';

const TABS: Array<{
  value: RightTab;
  label: string;
  code: string;
  icon: typeof Scissors;
}> = [
  { value: 'clip', label: '剖切', code: 'CLIP', icon: Scissors },
  { value: 'boolean', label: '布尔', code: 'CSG', icon: Combine },
  { value: 'projection', label: '投影', code: 'PROJ', icon: ScanLine },
];

export function RightPanel() {
  const rightTab = useStudioStore((state) => state.rightTab);
  const setRightTab = useStudioStore((state) => state.setRightTab);
  const projectionCount = useStudioStore((state) => state.projections.length);
  const objectCount = useStudioStore((state) => state.objects.length);

  return (
    <aside className="sidebar right-panel">
      <div className="right-panel-head">
        <div className="panel-caption">
          <span>操作台</span>
          <span className="panel-caption-line" />
          <span className="panel-caption-code">OPERATE</span>
        </div>
        <div className="ops-tabs" role="tablist" aria-label="操作面板">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = rightTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={`ops-tab ${active ? 'is-active' : ''}`}
                onClick={() => setRightTab(tab.value)}
              >
                <Icon size={15} strokeWidth={1.8} />
                <span className="ops-tab-label">{tab.label}</span>
                <span className="ops-tab-code">{tab.code}</span>
                {tab.value === 'projection' && projectionCount > 0 ? (
                  <span className="ops-tab-badge">{projectionCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-scroll right-panel-scroll" role="tabpanel">
        {rightTab === 'clip' ? <ClipPanel /> : null}
        {rightTab === 'boolean' ? <CsgPanel /> : null}
        {rightTab === 'projection' ? <ProjectionPanel /> : null}
      </div>

      <div className="sidebar-footer right-footer">
        <span className="footer-status"><span className="footer-dot" />本地运算</span>
        <span className="sidebar-footer-sep" />
        <span>{objectCount} solids</span>
        <span className="sidebar-footer-sep" />
        <span>WebGL · CSG</span>
      </div>
    </aside>
  );
}
