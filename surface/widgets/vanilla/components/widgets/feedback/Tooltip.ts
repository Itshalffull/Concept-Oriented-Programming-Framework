// ============================================================
// Tooltip — Vanilla DOM Widget
//
// Text tooltip shown on hover/focus with positioning and delays.
// ============================================================

export interface TooltipProps {
  label?: string;
  placement?: string;
  openDelay?: number;
  closeDelay?: number;
  className?: string;
}

export interface TooltipOptions { target: HTMLElement; props: TooltipProps; }

let _tooltipUid = 0;

export class Tooltip {
  private el: HTMLElement;
  private props: TooltipProps;
  private uid: string;
  private state = 'idle';

  constructor(options: TooltipOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `tooltip-${++_tooltipUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'tooltip');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<TooltipProps>): void {
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
