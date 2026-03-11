// ============================================================
// CanvasNode — Vanilla DOM Widget
//
// Draggable node on a canvas with ports and selection.
// ============================================================

export interface CanvasNodeProps {
  id: string;
  x: number;
  y: number;
  label?: string;
  ports?: { id: string; type: "input" | "output"; label?: string }[];
  selected?: boolean;
  draggable?: boolean;
  onDrag?: (x: number, y: number) => void;
  onClick?: () => void;
  className?: string;
}

export interface CanvasNodeOptions { target: HTMLElement; props: CanvasNodeProps; }

let _canvasNodeUid = 0;

export class CanvasNode {
  private el: HTMLElement;
  private props: CanvasNodeProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CanvasNodeOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `canvas-node-${++_canvasNodeUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'canvas-node');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CanvasNodeProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }

  private render(): void {
    this.syncState();
  }

  private syncState(): void {
    this.el.setAttribute('data-state', this.state);
  }
}
