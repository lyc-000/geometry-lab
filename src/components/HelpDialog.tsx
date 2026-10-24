import { Modal, Kbd, Formula } from './ui';

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="使用指南"
      kicker="GUIDE / 坐标系与运算边界"
      className="help-dialog"
      footer={
        <button type="button" className="primary-button" onClick={() => onOpenChange(false)}>
          开始实验
        </button>
      }
    >
      <div className="help-content">
        <section className="help-section">
          <div className="help-index">01</div>
          <div>
            <h3>坐标约定</h3>
            <p>
              场景采用数学右手系：<strong>X 轴向右（红）</strong>、
              <strong>Y 轴向内（绿）</strong>、<strong>Z 轴向上（蓝）</strong>。
              网格位于 XOY 平面，所有对象坐标均直接使用世界坐标。
            </p>
            <p className="help-note">
              <Formula latex="z" /> 为高度方向；三视图会分别压平到 XOY、YOZ、XOZ 平面。
            </p>
          </div>
        </section>

        <section className="help-section">
          <div className="help-index">02</div>
          <div>
            <h3>四步工作流</h3>
            <ol className="help-list">
              <li>
                <span className="help-step">创建</span>
                添加解析立体（球 / 圆柱 / 长方体），或输入封闭不等式 / 方程。
              </li>
              <li>
                <span className="help-step">剖切</span>
                输入线性平面，实时用 Three.js ClippingPlanes 裁去一侧；也可“固化”为新的剖切实体。
              </li>
              <li>
                <span className="help-step">布尔</span>
                选择对象 A 与 B，执行 A−B、A∩B 或 A∪B。结果由 three-bvh-csg 生成，原对象会被移除并释放显存。
              </li>
              <li>
                <span className="help-step">投影</span>
                选中对象后，生成 XOY / YOZ / XOZ 半透明压扁投影。
              </li>
            </ol>
          </div>
        </section>

        <section className="help-section">
          <div className="help-index">03</div>
          <div>
            <h3>为什么要求水密实体？</h3>
            <p>
              CSG 仅对封闭、法线朝外的流形网格可靠。隐式实体通过 Marching Cubes
              提取后，会检查全部边是否恰好被两个三角面共享，并计算有向体积以校正面朝向。
              如果不封闭（例如单叶双曲面），会给出错误提示而不是让 CSG 产生破面。
            </p>
            <p className="help-note">
              若实体碰到采样边界，请扩大“采样范围”；细节不足则提高“采样精度”。
            </p>
          </div>
        </section>

        <section className="help-section">
          <div className="help-index">04</div>
          <div>
            <h3>视觉剖切 ≠ 几何剖切</h3>
            <p>
              勾选“视觉裁剪”只会影响 GPU 渲染，不改变原始 BufferGeometry；它适合观察内部结构。
              若后续要投影或继续 CSG，请使用“生成剖切实体”，它会把半空间与选中对象做一次真实的布尔交集。
            </p>
          </div>
        </section>

        <section className="help-section shortcuts">
          <div className="help-index">05</div>
          <div>
            <h3>视口操作</h3>
            <div className="shortcut-grid">
              <span><Kbd>左键拖动</Kbd> 旋转</span>
              <span><Kbd>右键拖动</Kbd> 平移</span>
              <span><Kbd>滚轮</Kbd> 缩放</span>
              <span><Kbd>单击实体</Kbd> 选中对象</span>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
