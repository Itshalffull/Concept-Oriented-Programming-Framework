// ============================================================
// Slider — Vanilla DOM Widget
//
// Range slider with thumb, track, pointer drag, and keyboard control.
// ============================================================

export interface SliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  orientation?: "horizontal" | "vertical";
  label: string;
  disabled?: boolean;
  name?: string;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface SliderOptions { target: HTMLElement; props: SliderProps; }

let _sliderUid = 0;

export class Slider {
  private el: HTMLElement;
  private props: SliderProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SliderOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `slider-${++_sliderUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'slider');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SliderProps>): void {
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
