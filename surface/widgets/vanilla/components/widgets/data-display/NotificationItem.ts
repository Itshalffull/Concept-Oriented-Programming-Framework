// ============================================================
// NotificationItem — Vanilla DOM Widget
//
// Single notification entry with actions and timestamp.
// ============================================================

export interface NotificationItemProps {
  title: string;
  description?: string;
  timestamp?: string;
  read?: boolean;
  variant?: "info" | "success" | "warning" | "error";
  actions?: { label: string; onClick: () => void }[];
  onRead?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export interface NotificationItemOptions { target: HTMLElement; props: NotificationItemProps; }

let _notificationItemUid = 0;

export class NotificationItem {
  private el: HTMLElement;
  private props: NotificationItemProps;
  private uid: string;
  private state = 'idle';

  constructor(options: NotificationItemOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `notification-item-${++_notificationItemUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'notification-item');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<NotificationItemProps>): void {
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
