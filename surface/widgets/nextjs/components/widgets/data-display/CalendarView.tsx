'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useMemo,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import {
  calendarViewReducer,
  isSameDay,
  getMonthGrid,
  formatDate,
  type CalendarViewState,
  type CalendarViewAction,
} from './CalendarView.reducer.js';

// Props from calendar-view.widget spec
export interface CalendarEvent {
  date: string;
  label: string;
  id?: string;
}

export interface CalendarViewProps {
  value: string;
  view?: 'month' | 'week';
  events?: CalendarEvent[];
  ariaLabel?: string;
  minDate?: string;
  maxDate?: string;
  todayLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onSelectDate?: (date: string) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  onViewChange?: (view: 'month' | 'week') => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  children?: ReactNode;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView = forwardRef<HTMLDivElement, CalendarViewProps>(
  function CalendarView(
    {
      value,
      view = 'month',
      events = [],
      ariaLabel = 'Calendar',
      minDate,
      maxDate,
      todayLabel = 'Today',
      size = 'md',
      onSelectDate,
      onNavigate,
      onEventClick,
      className,
      children,
    },
    ref
  ) {
    const initialDate = value ? new Date(value) : new Date();
    const [state, dispatch] = useReducer(calendarViewReducer, {
      current: view === 'month' ? 'monthView' : 'weekView',
      focusedDate: initialDate,
      displayDate: initialDate,
    });
    const baseId = useId();

    const today = useMemo(() => new Date(), []);
    const minD = minDate ? new Date(minDate) : null;
    const maxD = maxDate ? new Date(maxDate) : null;

    const weeks = useMemo(
      () => getMonthGrid(state.displayDate.getFullYear(), state.displayDate.getMonth()),
      [state.displayDate]
    );

    const periodLabel = useMemo(() => {
      const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
      return state.displayDate.toLocaleDateString(undefined, opts);
    }, [state.displayDate]);

    const eventsByDate = useMemo(() => {
      const map = new Map<string, CalendarEvent[]>();
      for (const ev of events) {
        const key = ev.date.split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
      return map;
    }, [events]);

    const handlePrev = useCallback(() => {
      dispatch({ type: 'NAVIGATE_PREV' });
      onNavigate?.('prev');
      // Auto-complete navigation for synchronous usage
      setTimeout(() => {
        dispatch({
          type: view === 'month' ? 'NAVIGATE_COMPLETE' : 'NAVIGATE_COMPLETE_WEEK',
        });
      }, 0);
    }, [view, onNavigate]);

    const handleNext = useCallback(() => {
      dispatch({ type: 'NAVIGATE_NEXT' });
      onNavigate?.('next');
      setTimeout(() => {
        dispatch({
          type: view === 'month' ? 'NAVIGATE_COMPLETE' : 'NAVIGATE_COMPLETE_WEEK',
        });
      }, 0);
    }, [view, onNavigate]);

    const handleSelectDate = useCallback(
      (date: Date) => {
        dispatch({ type: 'SELECT_DATE', date });
        onSelectDate?.(formatDate(date));
      },
      [onSelectDate]
    );

    const handleDayCellKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTableCellElement>, date: Date) => {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_DAY', offset: -1 });
            break;
          case 'ArrowRight':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_DAY', offset: 1 });
            break;
          case 'ArrowUp':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_WEEK', offset: -1 });
            break;
          case 'ArrowDown':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_WEEK', offset: 1 });
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            handleSelectDate(date);
            break;
          case 'PageUp':
            e.preventDefault();
            handlePrev();
            break;
          case 'PageDown':
            e.preventDefault();
            handleNext();
            break;
          case 'Home':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_DAY', offset: -date.getDay() });
            break;
          case 'End':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_DAY', offset: 6 - date.getDay() });
            break;
        }
      },
      [handleSelectDate, handlePrev, handleNext]
    );

    const isNavigating = state.current === 'navigating';

    return (
      <div
        ref={ref}
        className={className}
        role="application"
        aria-roledescription="calendar"
        aria-label={ariaLabel}
        data-surface-widget=""
        data-widget-name="calendar-view"
        data-part="root"
        data-view={view}
        data-state={isNavigating ? 'navigating' : 'idle'}
        data-size={size}
      >
        <div data-part="header">
          <div
            data-part="navigation"
            role="group"
            aria-label="Calendar navigation"
          >
            <button
              type="button"
              role="button"
              aria-label={view === 'month' ? 'Previous month' : 'Previous week'}
              data-part="prev-button"
              tabIndex={0}
              onClick={handlePrev}
            >
              &lt;
            </button>
            <span
              data-part="title"
              aria-live="polite"
              aria-atomic="true"
              role="heading"
            >
              {periodLabel}
            </span>
            <button
              type="button"
              role="button"
              aria-label={view === 'month' ? 'Next month' : 'Next week'}
              data-part="next-button"
              tabIndex={0}
              onClick={handleNext}
            >
              &gt;
            </button>
          </div>
        </div>
        <table
          role="grid"
          aria-label={periodLabel}
          data-view={view}
          aria-busy={isNavigating ? 'true' : 'false'}
        >
          <thead>
            <tr>
              {DAY_NAMES.map((day) => (
                <th key={day} scope="col" abbr={day}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex} role="row" data-part="week-row">
                {week.map((date) => {
                  const dateStr = formatDate(date);
                  const isToday = isSameDay(date, today);
                  const isSelected = isSameDay(date, state.focusedDate);
                  const isOutsideMonth = date.getMonth() !== state.displayDate.getMonth();
                  const isDisabled =
                    (minD && date < minD) || (maxD && date > maxD) || false;
                  const dayEvents = eventsByDate.get(dateStr) || [];
                  const isFocused = isSameDay(date, state.focusedDate);

                  return (
                    <td
                      key={dateStr}
                      role="gridcell"
                      aria-selected={isSelected ? 'true' : 'false'}
                      aria-disabled={isDisabled ? 'true' : 'false'}
                      aria-label={date.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      tabIndex={isFocused ? 0 : -1}
                      data-today={isToday ? 'true' : 'false'}
                      data-selected={isSelected ? 'true' : 'false'}
                      data-outside={isOutsideMonth ? 'true' : 'false'}
                      data-disabled={isDisabled ? 'true' : 'false'}
                      data-has-events={dayEvents.length > 0 ? 'true' : 'false'}
                      onClick={() => {
                        if (!isDisabled) handleSelectDate(date);
                      }}
                      onFocus={() => dispatch({ type: 'FOCUS_DATE', date })}
                      onKeyDown={(e) => handleDayCellKeyDown(e, date)}
                    >
                      <span data-part="day-label" aria-hidden="true">
                        {date.getDate()}
                      </span>
                      {isToday && (
                        <span className="sr-only">{todayLabel}</span>
                      )}
                      {dayEvents.length > 0 && (
                        <div
                          data-part="event-list"
                          role="list"
                          aria-label={`Events on ${date.toLocaleDateString()}`}
                        >
                          {dayEvents.map((ev, evIdx) => (
                            <button
                              key={ev.id ?? evIdx}
                              type="button"
                              role="button"
                              aria-label={ev.label}
                              data-part="event"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(ev);
                              }}
                            >
                              {ev.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {children}
      </div>
    );
  }
);

CalendarView.displayName = 'CalendarView';
export default CalendarView;
