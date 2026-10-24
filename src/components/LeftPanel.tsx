import { AddObjectPanel } from './AddObjectPanel';
import { ObjectList } from './ObjectList';
import { Kbd } from './ui';

export function LeftPanel() {
  return (
    <aside className="sidebar left-panel">
      <div className="sidebar-scroll">
        <div className="panel-caption">
          <span>构建</span>
          <span className="panel-caption-line" />
          <span className="panel-caption-code">BUILD / SOLIDS</span>
        </div>
        <AddObjectPanel />
        <div className="panel-rule" />
        <ObjectList />
      </div>
      <div className="sidebar-footer">
        <Kbd>单击</Kbd>
        <span>选中实体</span>
        <span className="sidebar-footer-sep" />
        <span>拖拽视口旋转观察</span>
      </div>
    </aside>
  );
}
