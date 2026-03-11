// ============================================================
// ColorLabelPicker — Vanilla DOM Widget
//
// Color-coded label selector for categorization.
// ============================================================

export interface ColorLabelPickerProps {
  labels: { id: string; name: string; color: string }[];
  value?: string;
  onChange?: (id: string) => void;
  allowCreate?: boolean;
  onCreate?: (name: string, color: string) => void;
  className?: string;
}

export interface ColorLabelPickerOptions { target: HTMLElement; props: ColorLabelPickerProps; }

let _colorLabelPickerUid = 0;

export class ColorLabelPicker {
  private el: HTMLElement;
  private props: ColorLabelPickerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ColorLabelPickerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `color-label-picker-${++_colorLabelPickerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'color-label-picker');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ColorLabelPickerProps>): void {
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
