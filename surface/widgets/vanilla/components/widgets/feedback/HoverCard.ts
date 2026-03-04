// ============================================================
// HoverCard — Vanilla DOM Widget
//
// Popup card shown on hover with open/close delays.
// ============================================================

export interface HoverCardProps {
  openDelay?: number;
  closeDelay?: number;
  placement?: string;
  className?: string;
}

export interface HoverCardOptions { target: HTMLElement; props: HoverCardProps; }

let _hoverCardUid = 0;

export class HoverCard {
  private el: HTMLElement;
  private props: HoverCardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: HoverCardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `hover-card-${++_hoverCardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'hover-card');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<HoverCardProps>): void {
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
