// ============================================================
// QueueDashboard — Vanilla DOM Widget
//
// Job queue monitoring dashboard with stats and job list.
// ============================================================

export interface QueueDashboardProps {
  stats?: { pending: number; active: number; completed: number; failed: number };
  jobs?: { id: string; name: string; status: string; progress?: number; createdAt?: string }[];
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  loading?: boolean;
  className?: string;
}

export interface QueueDashboardOptions { target: HTMLElement; props: QueueDashboardProps; }

let _queueDashboardUid = 0;

export class QueueDashboard {
  private el: HTMLElement;
  private props: QueueDashboardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: QueueDashboardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `queue-dashboard-${++_queueDashboardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'queue-dashboard');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<QueueDashboardProps>): void {
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
