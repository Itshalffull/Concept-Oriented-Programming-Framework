/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------- */

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/* ---------------------------------------------------------------------------
 * State machine
 * Popover: closed (initial) -> open
 * View: dayView (initial) -> monthView -> yearView
 * Focus: idle (initial) -> focused
 * Validation: valid (initial) -> invalid
 * ------------------------------------------------------------------------- */

export type PopoverState = 'closed' | 'open';
export type ViewState = 'dayView' | 'monthView' | 'yearView';
export type FocusState = 'idle' | 'focused';
export type ValidationState = 'valid' | 'invalid';

export interface DatePickerMachine {
  popover: PopoverState;
  view: ViewState;
  focus: FocusState;
  validation: ValidationState;
  focusedYear: number;
  focusedMonth: number;
  focusedDay: number;
}

export type DatePickerEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TRIGGER_CLICK' }
  | { type: 'ESCAPE' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'SELECT_DATE'; date: Date }
  | { type: 'VIEW_UP' }
  | { type: 'SELECT_MONTH'; month: number }
  | { type: 'SELECT_YEAR'; year: number }
  | { type: 'PREV_MONTH' }
  | { type: 'NEXT_MONTH' }
  | { type: 'NAVIGATE_UP' }
  | { type: 'NAVIGATE_DOWN' }
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'FIRST_DAY' }
  | { type: 'LAST_DAY' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'INVALIDATE' }
  | { type: 'VALIDATE' };

export function datePickerReducer(state: DatePickerMachine, event: DatePickerEvent): DatePickerMachine {
  const s = { ...state };

  switch (event.type) {
    case 'OPEN':
    case 'TRIGGER_CLICK':
      if (s.popover === 'closed') s.popover = 'open';
      else s.popover = 'closed';
      break;
    case 'CLOSE':
    case 'ESCAPE':
    case 'OUTSIDE_CLICK':
      s.popover = 'closed';
      s.view = 'dayView';
      break;
    case 'SELECT_DATE':
      s.popover = 'closed';
      s.view = 'dayView';
      break;
    case 'VIEW_UP':
      if (s.view === 'dayView') s.view = 'monthView';
      else if (s.view === 'monthView') s.view = 'yearView';
      break;
    case 'SELECT_MONTH':
      s.view = 'dayView';
      s.focusedMonth = event.month;
      break;
    case 'SELECT_YEAR':
      s.view = 'monthView';
      s.focusedYear = event.year;
      break;
    case 'PREV_MONTH':
      if (s.focusedMonth === 0) { s.focusedMonth = 11; s.focusedYear--; }
      else s.focusedMonth--;
      break;
    case 'NEXT_MONTH':
      if (s.focusedMonth === 11) { s.focusedMonth = 0; s.focusedYear++; }
      else s.focusedMonth++;
      break;
    case 'NAVIGATE_UP':
      s.focusedDay = Math.max(1, s.focusedDay - 7);
      break;
    case 'NAVIGATE_DOWN': {
      const daysInMonth = getDaysInMonth(s.focusedYear, s.focusedMonth);
      s.focusedDay = Math.min(daysInMonth, s.focusedDay + 7);
      break;
    }
    case 'NAVIGATE_PREV':
      if (s.focusedDay > 1) s.focusedDay--;
      break;
    case 'NAVIGATE_NEXT': {
      const dim = getDaysInMonth(s.focusedYear, s.focusedMonth);
      if (s.focusedDay < dim) s.focusedDay++;
      break;
    }
    case 'FIRST_DAY':
      s.focusedDay = 1;
      break;
    case 'LAST_DAY':
      s.focusedDay = getDaysInMonth(s.focusedYear, s.focusedMonth);
      break;
    case 'FOCUS':
      s.focus = 'focused';
      break;
    case 'BLUR':
      s.focus = 'idle';
      break;
    case 'INVALIDATE':
      s.validation = 'invalid';
      break;
    case 'VALIDATE':
      s.validation = 'valid';
      break;
  }

  return s;
}
