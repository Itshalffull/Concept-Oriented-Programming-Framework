// ============================================================
// Gauge — Vanilla DOM Widget
//
// Circular or semicircular gauge with value display and thresholds.
// ============================================================

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  thresholds?: { value: number; color: string }[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface GaugeOptions { target: HTMLElement; props: GaugeProps; }

let _gaugeUid = 0;

export class Gauge {
  private el: HTMLElement;
  private props: GaugeProps;
  private uid: string;
  private state = 'idle';

  constructor(options: GaugeOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `gauge-${++_gaugeUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'gauge');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<GaugeProps>): void {
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
