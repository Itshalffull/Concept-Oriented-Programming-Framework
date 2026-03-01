export type CalendarViewState = {
  current: 'monthView' | 'weekView' | 'navigating';
  focusedDate: Date;
  displayDate: Date;
};

export type CalendarViewAction =
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'NAVIGATE_COMPLETE' }
  | { type: 'NAVIGATE_COMPLETE_WEEK' }
  | { type: 'SWITCH_MONTH' }
  | { type: 'SWITCH_WEEK' }
  | { type: 'SELECT_DATE'; date: Date }
  | { type: 'FOCUS_DATE'; date: Date }
  | { type: 'NAVIGATE_DAY'; offset: number }
  | { type: 'NAVIGATE_WEEK'; offset: number };

export function calendarViewReducer(state: CalendarViewState, action: CalendarViewAction): CalendarViewState {
  switch (action.type) {
    case 'NAVIGATE_PREV': {
      const next = new Date(state.displayDate);
      if (state.current === 'monthView' || state.current === 'navigating') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setDate(next.getDate() - 7);
      }
      return { ...state, displayDate: next, current: 'navigating' };
    }
    case 'NAVIGATE_NEXT': {
      const next = new Date(state.displayDate);
      if (state.current === 'monthView' || state.current === 'navigating') {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 7);
      }
      return { ...state, displayDate: next, current: 'navigating' };
    }
    case 'NAVIGATE_COMPLETE':
      return { ...state, current: 'monthView' };
    case 'NAVIGATE_COMPLETE_WEEK':
      return { ...state, current: 'weekView' };
    case 'SWITCH_MONTH':
      return { ...state, current: 'monthView' };
    case 'SWITCH_WEEK':
      return { ...state, current: 'weekView' };
    case 'SELECT_DATE':
      return { ...state, focusedDate: action.date };
    case 'FOCUS_DATE':
      return { ...state, focusedDate: action.date };
    case 'NAVIGATE_DAY': {
      const next = new Date(state.focusedDate);
      next.setDate(next.getDate() + action.offset);
      return { ...state, focusedDate: next };
    }
    case 'NAVIGATE_WEEK': {
      const next = new Date(state.focusedDate);
      next.setDate(next.getDate() + action.offset * 7);
      return { ...state, focusedDate: next };
    }
    default:
      return state;
  }
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startOfWeek = new Date(firstDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const weeks: Date[][] = [];
  const current = new Date(startOfWeek);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    // Stop if we've passed the month and filled at least 4 weeks
    if (current.getMonth() !== month && weeks.length >= 4) break;
  }
  return weeks;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
