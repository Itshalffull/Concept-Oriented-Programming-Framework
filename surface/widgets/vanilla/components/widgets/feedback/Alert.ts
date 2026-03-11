// ============================================================
// Alert — Vanilla DOM Widget
//
// Status alert with variant, closable dismiss, title and description.
// ============================================================

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  closable?: boolean;
  title?: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}

export interface AlertOptions { target: HTMLElement; props: AlertProps; }

let _alertUid = 0;

export class Alert {
  private el: HTMLElement;
  private props: AlertProps;
  private uid: string;
  private state = 'idle';

  constructor(options: AlertOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `alert-${++_alertUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'alert');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<AlertProps>): void {
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
