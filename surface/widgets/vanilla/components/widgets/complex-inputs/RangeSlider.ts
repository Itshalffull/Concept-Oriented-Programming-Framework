// ============================================================
// RangeSlider — Vanilla DOM Widget
//
// Dual-thumb range slider for selecting a value range.
// ============================================================

export interface RangeSliderProps {
  value?: [number, number];
  defaultValue?: [number, number];
  min?: number;
  max?: number;
  step?: number;
  orientation?: "horizontal" | "vertical";
  label: string;
  disabled?: boolean;
  onChange?: (value: [number, number]) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface RangeSliderOptions { target: HTMLElement; props: RangeSliderProps; }

let _rangeSliderUid = 0;

export class RangeSlider {
  private el: HTMLElement;
  private props: RangeSliderProps;
  private uid: string;
  private state = 'idle';

  constructor(options: RangeSliderOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `range-slider-${++_rangeSliderUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'range-slider');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<RangeSliderProps>): void {
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
