// ============================================================
// DateRangePicker — Vanilla DOM Widget
//
// Date range selection with dual calendar views.
// ============================================================

export interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  min?: Date | null;
  max?: Date | null;
  presets?: { label: string; startDate: Date; endDate: Date }[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (start: Date | null, end: Date | null) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface DateRangePickerOptions { target: HTMLElement; props: DateRangePickerProps; }

let _dateRangePickerUid = 0;

export class DateRangePicker {
  private el: HTMLElement;
  private props: DateRangePickerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DateRangePickerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `date-range-picker-${++_dateRangePickerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'date-range-picker');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DateRangePickerProps>): void {
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
