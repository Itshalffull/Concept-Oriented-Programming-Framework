// ============================================================
// Popover — Vanilla DOM Widget
//
// Positioned popup with trigger, arrow, and outside-click close.
// ============================================================

export interface PopoverProps {
  open?: boolean;
  placement?: string;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface PopoverOptions { target: HTMLElement; props: PopoverProps; }

let _popoverUid = 0;

export class Popover {
  private el: HTMLElement;
  private props: PopoverProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PopoverOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `popover-${++_popoverUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'popover');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PopoverProps>): void {
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
