// ============================================================
// NotificationCenter — Vanilla DOM Widget
//
// Notification inbox with read/unread, filters, and actions.
// ============================================================

export interface NotificationCenterProps {
  notifications?: { id: string; title: string; description?: string; read?: boolean; timestamp?: string; variant?: string }[];
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMarkAllRead?: () => void;
  loading?: boolean;
  className?: string;
}

export interface NotificationCenterOptions { target: HTMLElement; props: NotificationCenterProps; }

let _notificationCenterUid = 0;

export class NotificationCenter {
  private el: HTMLElement;
  private props: NotificationCenterProps;
  private uid: string;
  private state = 'idle';

  constructor(options: NotificationCenterOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `notification-center-${++_notificationCenterUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'notification-center');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<NotificationCenterProps>): void {
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
