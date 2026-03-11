// ============================================================
// ColorPicker — Vanilla DOM Widget
//
// Color selection widget with spectrum, swatches, and input.
// ============================================================

export interface ColorPickerProps {
  value?: string;
  defaultValue?: string;
  format?: "hex" | "rgb" | "hsl";
  swatches?: string[];
  showInput?: boolean;
  disabled?: boolean;
  onChange?: (color: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ColorPickerOptions { target: HTMLElement; props: ColorPickerProps; }

let _colorPickerUid = 0;

export class ColorPicker {
  private el: HTMLElement;
  private props: ColorPickerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ColorPickerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `color-picker-${++_colorPickerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'color-picker');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ColorPickerProps>): void {
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
