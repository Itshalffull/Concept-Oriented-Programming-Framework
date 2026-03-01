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
import { dateRangeReducer, getDaysInMonth } from './DateRangePicker.reducer.js';

/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------- */

function formatDate(date: Date | null, format: string): string {
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

function isInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  return date >= start && date <= end;
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

export interface DateRangePreset {
  label: string;
  range: { start: Date; end: Date };
}

export interface DateRangePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Selected start date. */
  startDate?: Date | null;
  /** Default start date (uncontrolled). */
  defaultStartDate?: Date | null;
  /** Selected end date. */
  endDate?: Date | null;
  /** Default end date (uncontrolled). */
  defaultEndDate?: Date | null;
  /** Minimum selectable date. */
  min?: Date | null;
  /** Maximum selectable date. */
  max?: Date | null;
  /** Date format string. */
  format?: string;
  /** Locale code. */
  locale?: string;
  /** Preset ranges. */
  presets?: DateRangePreset[];
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Form field name. */
  name?: string;
  /** Close on complete selection. */
  closeOnSelect?: boolean;
  /** Accessible label. */
  label?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when range changes. */
  onChange?: (range: { start: Date | null; end: Date | null }) => void;
}

/* ---------------------------------------------------------------------------
 * Calendar grid builder
 * ------------------------------------------------------------------------- */

function buildMonth(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartOfWeek(year, month);
  const cells: Array<{ day: number; date: Date; outsideMonth: boolean }> = [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrev = getDaysInMonth(prevYear, prevMonth);
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ day: d, date: new Date(prevYear, prevMonth, d), outsideMonth: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d), outsideMonth: false });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, date: new Date(nextYear, nextMonth, nextDay), outsideMonth: true });
    nextDay++;
  }

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DateRangePicker = forwardRef<HTMLDivElement, DateRangePickerProps>(function DateRangePicker(
  {
    startDate: controlledStart,
    defaultStartDate = null,
    endDate: controlledEnd,
    defaultEndDate = null,
    min: minDate,
    max: maxDate,
    format = 'yyyy-MM-dd',
    locale: _locale = 'en',
    presets,
    disabled = false,
    readOnly = false,
    required = false,
    name,
    closeOnSelect = true,
    label = 'Date range',
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [startDate, setStartDate] = useControllableState<Date | null>({
    value: controlledStart,
    defaultValue: defaultStartDate,
    onChange: (s) => onChange?.({ start: s, end: endDate }),
  });

  const [endDate, setEndDate] = useControllableState<Date | null>({
    value: controlledEnd,
    defaultValue: defaultEndDate,
    onChange: (e) => onChange?.({ start: startDate, end: e }),
  });

  const now = new Date();
  const [machine, send] = useReducer(dateRangeReducer, {
    popover: 'closed',
    selection: 'selectingStart',
    hover: 'idle',
    focus: 'unfocused',
    focusedYear: (startDate ?? now).getFullYear(),
    focusedMonth: (startDate ?? now).getMonth(),
    focusedDay: (startDate ?? now).getDate(),
    hoverDate: null,
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

  const handleCellClick = useCallback(
    (date: Date) => {
      if (minDate && date < minDate) return;
      if (maxDate && date > maxDate) return;

      if (machine.selection === 'selectingStart') {
        setStartDate(date);
        setEndDate(null);
        send({ type: 'SELECT_CELL', date });
      } else {
        if (startDate && date < startDate) {
          setStartDate(date);
          setEndDate(startDate);
        } else {
          setEndDate(date);
        }
        send({ type: 'SELECT_CELL', date });
        if (closeOnSelect) {
          send({ type: 'CONFIRM' });
          triggerRef.current?.focus();
        }
      }
    },
    [machine.selection, startDate, minDate, maxDate, closeOnSelect, setStartDate, setEndDate],
  );

  const handlePresetClick = useCallback(
    (range: { start: Date; end: Date }) => {
      setStartDate(range.start);
      setEndDate(range.end);
      send({ type: 'SELECT_PRESET', range });
      if (closeOnSelect) {
        send({ type: 'CONFIRM' });
        triggerRef.current?.focus();
      }
    },
    [closeOnSelect, setStartDate, setEndDate],
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
        case 'Escape': e.preventDefault(); send({ type: 'ESCAPE' }); triggerRef.current?.focus(); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleCellClick(new Date(machine.focusedYear, machine.focusedMonth, machine.focusedDay));
          break;
      }
    },
    [machine.focusedYear, machine.focusedMonth, machine.focusedDay, handleCellClick],
  );

  // Build two calendar months
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const secondMonth = machine.focusedMonth === 11 ? 0 : machine.focusedMonth + 1;
  const secondYear = machine.focusedMonth === 11 ? machine.focusedYear + 1 : machine.focusedYear;

  const gridStart = useMemo(() => buildMonth(machine.focusedYear, machine.focusedMonth), [machine.focusedYear, machine.focusedMonth]);
  const gridEnd = useMemo(() => buildMonth(secondYear, secondMonth), [secondYear, secondMonth]);

  const isOpen = machine.popover === 'open';
  const startMonthLabel = `${monthNames[machine.focusedMonth]} ${machine.focusedYear}`;
  const endMonthLabel = `${monthNames[secondMonth]} ${secondYear}`;

  const renderCell = (cell: { day: number; date: Date; outsideMonth: boolean }) => {
    const outOfRange = (minDate && cell.date < minDate) || (maxDate && cell.date > maxDate);
    const isRangeStart = isSameDay(cell.date, startDate);
    const isRangeEnd = isSameDay(cell.date, endDate);
    const inRange = isInRange(cell.date, startDate, endDate);
    const inPreview = machine.selection === 'selectingEnd' && startDate && machine.hoverDate
      ? isInRange(cell.date, startDate, machine.hoverDate)
      : false;
    const isFocusedCell = !cell.outsideMonth && cell.day === machine.focusedDay;

    const cellState = isRangeStart ? 'range-start' : isRangeEnd ? 'range-end' : inRange ? 'in-range' : 'default';

    return (
      <td
        key={cell.date.toISOString()}
        role="gridcell"
        aria-selected={isRangeStart || isRangeEnd ? 'true' : 'false'}
        aria-disabled={outOfRange ? 'true' : 'false'}
        data-part="cell"
        data-state={cellState}
        data-today={isToday(cell.date) ? 'true' : 'false'}
        data-outside-range={outOfRange ? 'true' : 'false'}
        data-outside-month={cell.outsideMonth ? 'true' : 'false'}
        data-preview={inPreview ? 'true' : 'false'}
        tabIndex={isFocusedCell ? 0 : -1}
        onClick={() => !outOfRange && handleCellClick(cell.date)}
        onMouseEnter={() => send({ type: 'HOVER_CELL', date: cell.date })}
        onMouseLeave={() => send({ type: 'HOVER_OUT' })}
        onKeyDown={handleCellKeyDown}
      >
        <span data-part="cell-label" aria-hidden="true">{cell.day}</span>
      </td>
    );
  };

  const renderGrid = (rows: ReturnType<typeof buildMonth>, gridLabel: string, partName: string) => (
    <table role="grid" aria-label={gridLabel} data-part={partName}>
      <thead>
        <tr role="row" data-part="row">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <th key={d} scope="col">{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} role="row" data-part="row">
            {row.map(renderCell)}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-part="root"
      data-state={isOpen ? 'open' : 'closed'}
      data-disabled={disabled ? 'true' : 'false'}
      data-readonly={readOnly ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="date-range-picker"
      {...rest}
    >
      <div ref={anchorRef} data-part="input-group">
        <input
          data-part="start-input"
          data-selecting={machine.selection === 'selectingStart' ? 'true' : 'false'}
          value={formatDate(startDate, format)}
          placeholder="Start date"
          disabled={disabled}
          readOnly={readOnly}
          aria-label="Start date"
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          onFocus={() => send({ type: 'FOCUS' })}
          onBlur={() => send({ type: 'BLUR' })}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); send({ type: 'OPEN' }); } }}
        />
        <input
          data-part="end-input"
          data-selecting={machine.selection === 'selectingEnd' ? 'true' : 'false'}
          value={formatDate(endDate, format)}
          placeholder="End date"
          disabled={disabled}
          readOnly={readOnly}
          aria-label="End date"
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          onFocus={() => send({ type: 'FOCUS' })}
          onBlur={() => send({ type: 'BLUR' })}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); send({ type: 'OPEN' }); } }}
        />
        <button
          ref={triggerRef}
          type="button"
          data-part="trigger"
          aria-label="Open date range calendar"
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          disabled={disabled}
          tabIndex={-1}
          onClick={() => send({ type: 'TRIGGER_CLICK' })}
        >
          &#x1F4C5;
        </button>
      </div>

      {name && (
        <>
          <input type="hidden" name={`${name}-start`} value={formatDate(startDate, format)} />
          <input type="hidden" name={`${name}-end`} value={formatDate(endDate, format)} />
        </>
      )}

      {isOpen && (
        <div data-part="positioner" data-state="open" data-placement="bottom-start">
          <div
            ref={floatingRef}
            id={contentId}
            role="dialog"
            aria-modal="true"
            aria-label="Date range calendar"
            data-part="content"
            data-state="open"
          >
            <div data-part="header">
              <button
                type="button"
                data-part="prev-button"
                aria-label="Previous month"
                onClick={() => send({ type: 'PREV_MONTH' })}
              >
                &#x2039;
              </button>
              <span data-part="title-start" aria-live="polite">{startMonthLabel}</span>
              <span data-part="title-end" aria-live="polite">{endMonthLabel}</span>
              <button
                type="button"
                data-part="next-button"
                aria-label="Next month"
                onClick={() => send({ type: 'NEXT_MONTH' })}
              >
                &#x203A;
              </button>
            </div>

            <div data-part="calendars">
              {renderGrid(gridStart, startMonthLabel, 'grid-start')}
              {renderGrid(gridEnd, endMonthLabel, 'grid-end')}
            </div>

            {presets && presets.length > 0 && (
              <div role="listbox" aria-label="Preset date ranges" data-part="presets">
                {presets.map((preset, i) => {
                  const active = startDate && endDate && isSameDay(startDate, preset.range.start) && isSameDay(endDate, preset.range.end);
                  return (
                    <button
                      key={i}
                      type="button"
                      role="option"
                      aria-selected={active ? 'true' : 'false'}
                      data-part="preset"
                      data-active={active ? 'true' : 'false'}
                      tabIndex={0}
                      onClick={() => handlePresetClick(preset.range)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePresetClick(preset.range); }}
                    >
                      {preset.label}
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

DateRangePicker.displayName = 'DateRangePicker';
export { DateRangePicker };
export default DateRangePicker;
