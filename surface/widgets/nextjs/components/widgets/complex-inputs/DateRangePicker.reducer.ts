/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------- */

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/* ---------------------------------------------------------------------------
 * State machine
 * Popover: closed (initial) -> open
 * Selection: selectingStart (initial) -> selectingEnd
 * Hover: idle (initial) -> hovering
 * Focus: unfocused (initial) -> focused
 * ------------------------------------------------------------------------- */

export type PopoverState = 'closed' | 'open';
export type SelectionState = 'selectingStart' | 'selectingEnd';
export type HoverState = 'idle' | 'hovering';
export type FocusState = 'unfocused' | 'focused';

export interface DateRangeMachine {
  popover: PopoverState;
  selection: SelectionState;
  hover: HoverState;
  focus: FocusState;
  focusedYear: number;
  focusedMonth: number;
  focusedDay: number;
  hoverDate: Date | null;
}

export type DateRangeEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TRIGGER_CLICK' }
  | { type: 'ESCAPE' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'CONFIRM' }
  | { type: 'SELECT_CELL'; date: Date }
  | { type: 'SELECT_PRESET'; range: { start: Date; end: Date } }
  | { type: 'HOVER_CELL'; date: Date }
  | { type: 'HOVER_OUT' }
  | { type: 'PREV_MONTH' }
  | { type: 'NEXT_MONTH' }
  | { type: 'NAVIGATE_UP' }
  | { type: 'NAVIGATE_DOWN' }
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export function dateRangeReducer(state: DateRangeMachine, event: DateRangeEvent): DateRangeMachine {
  const s = { ...state };

  switch (event.type) {
    case 'OPEN':
    case 'TRIGGER_CLICK':
      s.popover = s.popover === 'closed' ? 'open' : 'closed';
      break;
    case 'CLOSE':
    case 'ESCAPE':
    case 'OUTSIDE_CLICK':
      s.popover = 'closed';
      s.selection = 'selectingStart';
      break;
    case 'CONFIRM':
      s.popover = 'closed';
      s.selection = 'selectingStart';
      break;
    case 'SELECT_CELL':
      if (s.selection === 'selectingStart') {
        s.selection = 'selectingEnd';
      } else {
        s.selection = 'selectingStart';
      }
      break;
    case 'SELECT_PRESET':
      s.selection = 'selectingStart';
      break;
    case 'HOVER_CELL':
      s.hover = 'hovering';
      s.hoverDate = event.date;
      break;
    case 'HOVER_OUT':
      s.hover = 'idle';
      s.hoverDate = null;
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
      const dim = getDaysInMonth(s.focusedYear, s.focusedMonth);
      s.focusedDay = Math.min(dim, s.focusedDay + 7);
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
    case 'FOCUS':
      s.focus = 'focused';
      break;
    case 'BLUR':
      s.focus = 'unfocused';
      break;
  }

  return s;
}
