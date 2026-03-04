// ============================================================
// CalendarView — Vanilla DOM Widget
//
// Monthly calendar view with events and navigation.
// ============================================================

export interface CalendarViewProps {
  month?: number;
  year?: number;
  events?: { date: string; title: string; color?: string }[];
  onDateSelect?: (date: string) => void;
  onMonthChange?: (month: number, year: number) => void;
  className?: string;
}

export interface CalendarViewOptions { target: HTMLElement; props: CalendarViewProps; }

let _calendarViewUid = 0;

export class CalendarView {
  private el: HTMLElement;
  private props: CalendarViewProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CalendarViewOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `calendar-view-${++_calendarViewUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'calendar-view');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CalendarViewProps>): void {
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
