// ============================================================
// Minimap — Vanilla DOM Widget
//
// Miniature viewport indicator for large scrollable/zoomable areas.
// ============================================================

export interface MinimapProps {
  contentWidth: number;
  contentHeight: number;
  viewport: { x: number; y: number; width: number; height: number };
  onViewportChange?: (viewport: { x: number; y: number }) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface MinimapOptions { target: HTMLElement; props: MinimapProps; }

let _minimapUid = 0;

export class Minimap {
  private el: HTMLElement;
  private props: MinimapProps;
  private uid: string;
  private state = 'idle';

  constructor(options: MinimapOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `minimap-${++_minimapUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'minimap');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<MinimapProps>): void {
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
