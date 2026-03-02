// ============================================================
// Clef Surface Ink Widget — DateRangePicker
//
// Dual-calendar date range selection for the terminal. Shows
// two months side by side, tab to switch between start/end
// selection, arrow keys to navigate, and visual highlighting
// of the selected range. Maps the date-range-picker.widget
// anatomy (root, startInput, endInput, gridStart, gridEnd,
// header, cell) and states (popover, selection, hover, focus)
// to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface DateRangePickerProps {
  /** Start date as ISO string. */
  startDate?: string;
  /** End date as ISO string. */
  endDate?: string;
  /** Minimum selectable date as ISO string. */
  minDate?: string;
  /** Maximum selectable date as ISO string. */
  maxDate?: string;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Called when the date range changes. */
  onChange?: (range: { startDate: string; endDate: string }) => void;
}

// --------------- Helpers ---------------

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseDate = (s: string | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
};

const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfWeek = (year: number, month: number): number =>
  new Date(year, month, 1).getDay();

const dateToNum = (d: Date): number =>
  d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();

// --------------- Mini Calendar ---------------

interface MiniCalendarProps {
  year: number;
  month: number;
  cursorDay: number | null;
  startNum: number | null;
  endNum: number | null;
  minD: Date | null;
  maxD: Date | null;
  disabled: boolean;
  showCursor: boolean;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  year, month, cursorDay, startNum, endNum, minD, maxD, disabled, showCursor,
}) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <Box flexDirection="column">
      <Text bold>{MONTHS_SHORT[month]} {year}</Text>
      <Box>
        {DAYS.map((d) => (
          <Box key={d} width={4}><Text dimColor>{d}</Text></Box>
        ))}
      </Box>
      {weeks.map((wk, wi) => (
        <Box key={wi}>
          {wk.map((day, di) => {
            if (day === null) {
              return <Box key={`e-${di}`} width={4}><Text> </Text></Box>;
            }
            const cellDate = new Date(year, month, day);
            const cellNum = dateToNum(cellDate);
            const outOfRange =
              (minD && cellDate < minD) || (maxD && cellDate > maxD);
            const inRange =
              startNum !== null && endNum !== null &&
              cellNum >= startNum && cellNum <= endNum;
            const isEndpoint =
              cellNum === startNum || cellNum === endNum;
            const isCursor = day === cursorDay && showCursor;

            return (
              <Box key={day} width={4}>
                <Text
                  bold={isEndpoint || isCursor}
                  inverse={isCursor && !disabled}
                  color={outOfRange ? 'gray' : isEndpoint ? 'green' : inRange ? 'yellow' : undefined}
                  dimColor={disabled || outOfRange}
                >
                  {String(day).padStart(2, ' ')}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

// --------------- Component ---------------

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  minDate,
  maxDate,
  isFocused = false,
  disabled = false,
  onChange,
}) => {
  const startD = parseDate(startDate);
  const endD = parseDate(endDate);
  const minD = parseDate(minDate);
  const maxD = parseDate(maxDate);

  const today = new Date();
  // "start" or "end" selection mode
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');

  // First calendar month/year
  const [viewYear, setViewYear] = useState(startD?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(startD?.getMonth() ?? today.getMonth());

  const [cursorDay, setCursorDay] = useState(startD?.getDate() ?? today.getDate());
  // Cursor is on left (0) or right (1) calendar
  const [cursorSide, setCursorSide] = useState(0);

  useEffect(() => {
    if (startD && selecting === 'start') {
      setViewYear(startD.getFullYear());
      setViewMonth(startD.getMonth());
      setCursorDay(startD.getDate());
    }
  }, [startDate]);

  // Second calendar is the next month
  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const cursorYear = cursorSide === 0 ? viewYear : secondYear;
  const cursorMonth = cursorSide === 0 ? viewMonth : secondMonth;
  const daysInCursorMonth = getDaysInMonth(cursorYear, cursorMonth);

  const navigateMonth = useCallback(
    (delta: number) => {
      let m = viewMonth + delta;
      let y = viewYear;
      if (m < 0) { m = 11; y--; }
      else if (m > 11) { m = 0; y++; }
      setViewMonth(m);
      setViewYear(y);
    },
    [viewMonth, viewYear],
  );

  const startNum = startD ? dateToNum(startD) : null;
  const endNum = endD ? dateToNum(endD) : null;

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.tab) {
        setSelecting((s) => s === 'start' ? 'end' : 'start');
        return;
      }

      if (key.leftArrow) {
        setCursorDay((d) => {
          if (d <= 1) {
            if (cursorSide === 1) {
              setCursorSide(0);
              return getDaysInMonth(viewYear, viewMonth);
            }
            navigateMonth(-1);
            return getDaysInMonth(
              viewMonth === 0 ? viewYear - 1 : viewYear,
              viewMonth === 0 ? 11 : viewMonth - 1,
            );
          }
          return d - 1;
        });
      } else if (key.rightArrow) {
        const maxDay = daysInCursorMonth;
        setCursorDay((d) => {
          if (d >= maxDay) {
            if (cursorSide === 0) {
              setCursorSide(1);
              return 1;
            }
            navigateMonth(1);
            return 1;
          }
          return d + 1;
        });
      } else if (key.upArrow) {
        setCursorDay((d) => (d - 7 < 1 ? d : d - 7));
      } else if (key.downArrow) {
        setCursorDay((d) => (d + 7 > daysInCursorMonth ? d : d + 7));
      } else if (key.return) {
        const d = new Date(cursorYear, cursorMonth, cursorDay);
        if (minD && d < minD) return;
        if (maxD && d > maxD) return;
        const iso = toISO(d);
        if (selecting === 'start') {
          onChange?.({ startDate: iso, endDate: endDate ?? iso });
          setSelecting('end');
        } else {
          const sDate = startDate ?? iso;
          if (iso < sDate) {
            onChange?.({ startDate: iso, endDate: sDate });
          } else {
            onChange?.({ startDate: sDate, endDate: iso });
          }
          setSelecting('start');
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {/* Selection mode indicator */}
      <Box marginBottom={1}>
        <Text color={selecting === 'start' ? 'green' : undefined} bold={selecting === 'start'}>
          Start: {startDate ?? '---'}
        </Text>
        <Text> {'|'} </Text>
        <Text color={selecting === 'end' ? 'green' : undefined} bold={selecting === 'end'}>
          End: {endDate ?? '---'}
        </Text>
        <Text dimColor> (Tab to switch)</Text>
      </Box>

      {/* Two calendars side by side */}
      <Box>
        <Box marginRight={2}>
          <MiniCalendar
            year={viewYear}
            month={viewMonth}
            cursorDay={cursorSide === 0 ? cursorDay : null}
            startNum={startNum}
            endNum={endNum}
            minD={minD}
            maxD={maxD}
            disabled={disabled}
            showCursor={isFocused && cursorSide === 0}
          />
        </Box>
        <MiniCalendar
          year={secondYear}
          month={secondMonth}
          cursorDay={cursorSide === 1 ? cursorDay : null}
          startNum={startNum}
          endNum={endNum}
          minD={minD}
          maxD={maxD}
          disabled={disabled}
          showCursor={isFocused && cursorSide === 1}
        />
      </Box>

      {/* Hint */}
      {isFocused && !disabled && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2190\u2191\u2192\u2193'} navigate {'|'} Enter select {'|'} Tab switch start/end
          </Text>
        </Box>
      )}
    </Box>
  );
};

DateRangePicker.displayName = 'DateRangePicker';
export default DateRangePicker;
