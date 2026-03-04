// ============================================================
// Chart — Vanilla DOM Widget
//
// Data visualization chart with configurable type and series.
// ============================================================

export interface ChartProps {
  type?: "line" | "bar" | "pie" | "area" | "scatter";
  series: { name: string; data: { x: number | string; y: number }[] }[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  loading?: boolean;
  className?: string;
}

export interface ChartOptions { target: HTMLElement; props: ChartProps; }

let _chartUid = 0;

export class Chart {
  private el: HTMLElement;
  private props: ChartProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ChartOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `chart-${++_chartUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'chart');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ChartProps>): void {
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
