// ============================================================
// Toast — Vanilla DOM Widget
//
// Auto-dismiss notification with variant, action, and close button.
// ============================================================

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
  closable?: boolean;
  onDismiss?: () => void;
  onAction?: () => void;
  className?: string;
}

export interface ToastOptions { target: HTMLElement; props: ToastProps; }

let _toastUid = 0;

export class Toast {
  private el: HTMLElement;
  private props: ToastProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ToastOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `toast-${++_toastUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'toast');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ToastProps>): void {
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
