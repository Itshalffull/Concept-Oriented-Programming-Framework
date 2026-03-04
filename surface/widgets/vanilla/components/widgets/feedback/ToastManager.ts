// ============================================================
// ToastManager — Vanilla DOM Widget
//
// Container managing a stack of toast notifications.
// ============================================================

export interface ToastManagerProps {
  placement?: "top-start" | "top-center" | "top-end" | "bottom-start" | "bottom-center" | "bottom-end";
  maxVisible?: number;
  toasts?: { id: string; title?: string; description?: string; variant?: string }[];
  onDismiss?: (id: string) => void;
  className?: string;
}

export interface ToastManagerOptions { target: HTMLElement; props: ToastManagerProps; }

let _toastManagerUid = 0;

export class ToastManager {
  private el: HTMLElement;
  private props: ToastManagerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ToastManagerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `toast-manager-${++_toastManagerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'toast-manager');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ToastManagerProps>): void {
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
