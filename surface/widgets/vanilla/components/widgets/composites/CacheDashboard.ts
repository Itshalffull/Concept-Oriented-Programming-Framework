// ============================================================
// CacheDashboard — Vanilla DOM Widget
//
// Cache monitoring dashboard with metrics and key browser.
// ============================================================

export interface CacheDashboardProps {
  metrics?: { hitRate: number; missRate: number; size: number; maxSize: number };
  keys?: { key: string; size: number; ttl?: number; hits: number }[];
  onInvalidate?: (key: string) => void;
  onClearAll?: () => void;
  loading?: boolean;
  className?: string;
}

export interface CacheDashboardOptions { target: HTMLElement; props: CacheDashboardProps; }

let _cacheDashboardUid = 0;

export class CacheDashboard {
  private el: HTMLElement;
  private props: CacheDashboardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CacheDashboardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `cache-dashboard-${++_cacheDashboardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'cache-dashboard');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CacheDashboardProps>): void {
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
