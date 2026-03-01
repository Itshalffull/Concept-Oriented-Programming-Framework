'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useMemo,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { useFloatingPosition } from '../shared/useFloatingPosition.js';
import { useOutsideClick } from '../shared/useOutsideClick.js';
import { datePickerReducer, getDaysInMonth } from './DatePicker.reducer.js';

/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------- */

function formatDate(date: Date | null, format: string, _locale: string): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return format.replace('yyyy', String(y)).replace('MM', m).replace('dd', d);
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function getStartOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DatePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Selected date. */
  value?: Date | null;
  /** Default (uncontrolled) date. */
  defaultValue?: Date | null;
  /** Minimum selectable date. */
  min?: Date | null;
  /** Maximum selectable date. */
  max?: Date | null;
  /** Date format string. */
  format?: string;
  /** Locale code. */
  locale?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Form field name. */
  name?: string;
  /** Close calendar on date selection. */
  closeOnSelect?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when value changes. */
  onChange?: (date: Date | null) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    value: controlledValue,
    defaultValue = null,
    min: minDate,
    max: maxDate,
    format = 'yyyy-MM-dd',
    locale = 'en',
    placeholder = '',
    disabled = false,
    readOnly = false,
    required = false,
    name,
    closeOnSelect = true,
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControllableState<Date | null>({
    value: controlledValue,
    defaultValue,
    onChange,
  });

  const now = new Date();
  const initDate = value ?? now;

  const [machine, send] = useReducer(datePickerReducer, {
    popover: 'closed',
    view: 'dayView',
    focus: 'idle',
    validation: 'valid',
    focusedYear: initDate.getFullYear(),
    focusedMonth: initDate.getMonth(),
    focusedDay: initDate.getDate(),
  });

  const contentId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useFloatingPosition(anchorRef, floatingRef, {
    placement: 'bottom-start',
    enabled: machine.popover === 'open',
  });

  useOutsideClick(floatingRef, () => {
    if (machine.popover === 'open') send({ type: 'OUTSIDE_CLICK' });
  }, machine.popover === 'open');

  const handleSelectDate = useCallback(
    (date: Date) => {
      if (minDate && date < minDate) return;
      if (maxDate && date > maxDate) return;
      setValue(date);
      if (closeOnSelect) {
        send({ type: 'SELECT_DATE', date });
        triggerRef.current?.focus();
      }
    },
    [minDate, maxDate, setValue, closeOnSelect],
  );

  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); send({ type: 'NAVIGATE_UP' }); break;
        case 'ArrowDown': e.preventDefault(); send({ type: 'NAVIGATE_DOWN' }); break;
        case 'ArrowLeft': e.preventDefault(); send({ type: 'NAVIGATE_PREV' }); break;
        case 'ArrowRight': e.preventDefault(); send({ type: 'NAVIGATE_NEXT' }); break;
        case 'PageUp': e.preventDefault(); send({ type: 'PREV_MONTH' }); break;
        case 'PageDown': e.preventDefault(); send({ type: 'NEXT_MONTH' }); break;
        case 'Home': e.preventDefault(); send({ type: 'FIRST_DAY' }); break;
        case 'End': e.preventDefault(); send({ type: 'LAST_DAY' }); break;
        case 'Escape': e.preventDefault(); send({ type: 'ESCAPE' }); triggerRef.current?.focus(); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleSelectDate(new Date(machine.focusedYear, machine.focusedMonth, machine.focusedDay));
          break;
      }
    },
    [machine.focusedYear, machine.focusedMonth, machine.focusedDay, handleSelectDate],
  );

  // Build calendar grid for day view
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(machine.focusedYear, machine.focusedMonth);
    const startDay = getStartOfWeek(machine.focusedYear, machine.focusedMonth);
    const cells: Array<{ day: number; date: Date; outsideMonth: boolean }> = [];

    // Previous month filler
    const prevMonth = machine.focusedMonth === 0 ? 11 : machine.focusedMonth - 1;
    const prevYear = machine.focusedMonth === 0 ? machine.focusedYear - 1 : machine.focusedYear;
    const daysInPrev = getDaysInMonth(prevYear, prevMonth);
    for (let i = startDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      cells.push({ day: d, date: new Date(prevYear, prevMonth, d), outsideMonth: true });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(machine.focusedYear, machine.focusedMonth, d), outsideMonth: false });
    }

    // Next month filler
    const nextMonth = machine.focusedMonth === 11 ? 0 : machine.focusedMonth + 1;
    const nextYear = machine.focusedMonth === 11 ? machine.focusedYear + 1 : machine.focusedYear;
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ day: nextDay, date: new Date(nextYear, nextMonth, nextDay), outsideMonth: true });
      nextDay++;
    }

    // Chunk into rows of 7
    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [machine.focusedYear, machine.focusedMonth]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentViewLabel = machine.view === 'dayView'
    ? `${monthNames[machine.focusedMonth]} ${machine.focusedYear}`
    : machine.view === 'monthView'
      ? `${machine.focusedYear}`
      : `${Math.floor(machine.focusedYear / 10) * 10} - ${Math.floor(machine.focusedYear / 10) * 10 + 9}`;

  const isOpen = machine.popover === 'open';

  return (
    <div
      ref={ref}
      data-part="root"
      data-state={isOpen ? 'open' : 'closed'}
      data-disabled={disabled ? 'true' : 'false'}
      data-readonly={readOnly ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="date-picker"
      {...rest}
    >
      <div ref={anchorRef} data-part="input-group">
        <input
          data-part="input"
          value={formatDate(value, format, locale)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          name={name}
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          aria-controls={contentId}
          aria-invalid={machine.validation === 'invalid' ? 'true' : 'false'}
          onFocus={() => send({ type: 'FOCUS' })}
          onBlur={() => send({ type: 'BLUR' })}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); send({ type: 'OPEN' }); }
            if (e.key === 'Escape') send({ type: 'ESCAPE' });
          }}
        />
        <button
          ref={triggerRef}
          type="button"
          data-part="trigger"
          aria-label="Open calendar"
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          disabled={disabled}
          tabIndex={-1}
          onClick={() => send({ type: 'TRIGGER_CLICK' })}
        >
          &#x1F4C5;
        </button>
      </div>

      {isOpen && (
        <div data-part="positioner" data-state="open" data-placement="bottom-start">
          <div
            ref={floatingRef}
            id={contentId}
            role="dialog"
            aria-modal="true"
            aria-label="Calendar"
            data-part="content"
            data-state="open"
          >
            <div data-part="header" data-view={machine.view === 'dayView' ? 'day' : machine.view === 'monthView' ? 'month' : 'year'}>
              <button
                type="button"
                data-part="prev-button"
                aria-label={machine.view === 'dayView' ? 'Previous month' : machine.view === 'monthView' ? 'Previous year' : 'Previous decade'}
                onClick={() => send({ type: 'PREV_MONTH' })}
              >
                &#x2039;
              </button>

              <button
                type="button"
                data-part="view-button"
                aria-label={machine.view === 'dayView' ? 'Switch to month view' : 'Switch to year view'}
                onClick={() => send({ type: 'VIEW_UP' })}
              >
                <span data-part="title" aria-live="polite">{currentViewLabel}</span>
              </button>

              <button
                type="button"
                data-part="next-button"
                aria-label={machine.view === 'dayView' ? 'Next month' : machine.view === 'monthView' ? 'Next year' : 'Next decade'}
                onClick={() => send({ type: 'NEXT_MONTH' })}
              >
                &#x203A;
              </button>
            </div>

            {machine.view === 'dayView' && (
              <table role="grid" aria-label={currentViewLabel} data-part="grid" data-view="day">
                <thead>
                  <tr role="row" data-part="row">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <th key={d} scope="col" aria-label={d}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarDays.map((row, ri) => (
                    <tr key={ri} role="row" data-part="row">
                      {row.map((cell, ci) => {
                        const outOfRange = (minDate && cell.date < minDate) || (maxDate && cell.date > maxDate);
                        const isSelected = isSameDay(cell.date, value);
                        const isFocusedCell = !cell.outsideMonth && cell.day === machine.focusedDay;

                        return (
                          <td
                            key={ci}
                            role="gridcell"
                            aria-selected={isSelected ? 'true' : 'false'}
                            aria-disabled={outOfRange ? 'true' : 'false'}
                            data-part="cell"
                            data-state={isSelected ? 'selected' : 'default'}
                            data-today={isToday(cell.date) ? 'true' : 'false'}
                            data-outside-range={outOfRange ? 'true' : 'false'}
                            data-outside-month={cell.outsideMonth ? 'true' : 'false'}
                            tabIndex={isFocusedCell ? 0 : -1}
                            onClick={() => !outOfRange && handleSelectDate(cell.date)}
                            onKeyDown={handleCellKeyDown}
                          >
                            <span data-part="cell-label" aria-hidden="true">{cell.day}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {machine.view === 'monthView' && (
              <div role="grid" aria-label={currentViewLabel} data-part="grid" data-view="month">
                {monthNames.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    data-part="cell"
                    data-state={machine.focusedMonth === i ? 'selected' : 'default'}
                    onClick={() => send({ type: 'SELECT_MONTH', month: i })}
                  >
                    <span data-part="cell-label" aria-hidden="true">{m.slice(0, 3)}</span>
                  </button>
                ))}
              </div>
            )}

            {machine.view === 'yearView' && (
              <div role="grid" aria-label={currentViewLabel} data-part="grid" data-view="year">
                {Array.from({ length: 12 }, (_, i) => {
                  const decadeStart = Math.floor(machine.focusedYear / 10) * 10;
                  const year = decadeStart - 1 + i;
                  return (
                    <button
                      key={year}
                      type="button"
                      role="gridcell"
                      data-part="cell"
                      data-state={machine.focusedYear === year ? 'selected' : 'default'}
                      data-outside-range={i === 0 || i === 11 ? 'true' : 'false'}
                      onClick={() => send({ type: 'SELECT_YEAR', year })}
                    >
                      <span data-part="cell-label" aria-hidden="true">{year}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

DatePicker.displayName = 'DatePicker';
export { DatePicker };
export default DatePicker;
