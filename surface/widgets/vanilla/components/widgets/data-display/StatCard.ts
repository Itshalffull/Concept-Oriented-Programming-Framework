// ============================================================
// StatCard — Vanilla DOM Widget
//
// Statistics card with value, label, trend indicator, and icon.
// ============================================================

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { direction: "up" | "down" | "flat"; value: string };
  description?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface StatCardOptions { target: HTMLElement; props: StatCardProps; }

let _statCardUid = 0;

export class StatCard {
  private el: HTMLElement;
  private props: StatCardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: StatCardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `stat-card-${++_statCardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'stat-card');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<StatCardProps>): void {
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
