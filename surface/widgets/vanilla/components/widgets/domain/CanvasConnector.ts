// ============================================================
// CanvasConnector — Vanilla DOM Widget
//
// SVG connection line between canvas nodes.
// ============================================================

export interface CanvasConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  variant?: "straight" | "curved" | "step";
  label?: string;
  selected?: boolean;
  animated?: boolean;
  onClick?: () => void;
  className?: string;
}

export interface CanvasConnectorOptions { target: HTMLElement; props: CanvasConnectorProps; }

let _canvasConnectorUid = 0;

export class CanvasConnector {
  private el: HTMLElement;
  private props: CanvasConnectorProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CanvasConnectorOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `canvas-connector-${++_canvasConnectorUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'canvas-connector');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CanvasConnectorProps>): void {
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
