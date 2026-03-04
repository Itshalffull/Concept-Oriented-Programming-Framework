// ============================================================
// Canvas — Vanilla DOM Widget
//
// Infinite canvas with pan, zoom, and viewport management.
// ============================================================

export interface CanvasProps {
  viewport?: { x: number; y: number; zoom: number };
  minZoom?: number;
  maxZoom?: number;
  gridSize?: number;
  showGrid?: boolean;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  className?: string;
}

export interface CanvasOptions { target: HTMLElement; props: CanvasProps; }

let _canvasUid = 0;

export class Canvas {
  private el: HTMLElement;
  private props: CanvasProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CanvasOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `canvas-${++_canvasUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'canvas');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CanvasProps>): void {
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
