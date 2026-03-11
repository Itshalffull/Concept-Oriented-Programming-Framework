// ============================================================
// FloatingToolbar — Vanilla DOM Widget
//
// Floating toolbar that appears contextually.
// ============================================================

export interface FloatingToolbarProps {
  open?: boolean;
  placement?: string;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface FloatingToolbarOptions { target: HTMLElement; props: FloatingToolbarProps; }

let _floatingToolbarUid = 0;

export class FloatingToolbar {
  private el: HTMLElement;
  private props: FloatingToolbarProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FloatingToolbarOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `floating-toolbar-${++_floatingToolbarUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'floating-toolbar');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FloatingToolbarProps>): void {
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
