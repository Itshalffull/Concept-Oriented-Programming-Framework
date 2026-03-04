// ============================================================
// Skeleton — Vanilla DOM Widget
//
// Loading placeholder skeleton with configurable shape.
// ============================================================

export interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
  lines?: number;
  animate?: boolean;
  className?: string;
}

export interface SkeletonOptions { target: HTMLElement; props: SkeletonProps; }

let _skeletonUid = 0;

export class Skeleton {
  private el: HTMLElement;
  private props: SkeletonProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SkeletonOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `skeleton-${++_skeletonUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'skeleton');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SkeletonProps>): void {
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
