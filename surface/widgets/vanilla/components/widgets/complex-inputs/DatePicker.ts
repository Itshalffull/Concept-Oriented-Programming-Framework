// ============================================================
// DatePicker — Vanilla DOM Widget
//
// Calendar-based date picker with month/year navigation.
// ============================================================

export interface DatePickerProps {
  value?: Date | null;
  defaultValue?: Date | null;
  min?: Date | null;
  max?: Date | null;
  format?: string;
  locale?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  closeOnSelect?: boolean;
  size?: "sm" | "md" | "lg";
  onChange?: (date: Date | null) => void;
  className?: string;
}

export interface DatePickerOptions { target: HTMLElement; props: DatePickerProps; }

let _datePickerUid = 0;

export class DatePicker {
  private el: HTMLElement;
  private props: DatePickerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DatePickerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `date-picker-${++_datePickerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'date-picker');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DatePickerProps>): void {
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
