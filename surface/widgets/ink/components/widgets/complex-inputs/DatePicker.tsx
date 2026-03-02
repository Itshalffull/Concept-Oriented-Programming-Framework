// ============================================================
// Clef Surface Ink Widget — DatePicker
//
// Calendar-based date selection for the terminal. Renders a
// month grid with day numbers, arrow-key navigation, and
// enter to select. Maps the date-picker.widget anatomy (root,
// label, header, prevButton, nextButton, title, grid, row,
// cell) and states (popover, view, focus, validation) to
// keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface DatePickerProps {
  /** Current selected date as ISO string (e.g. "2026-03-15"). */
  value?: string;
  /** Minimum selectable date as ISO string. */
  minDate?: string;
  /** Maximum selectable date as ISO string. */
  maxDate?: string;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Called when the selected date changes. */
  onChange?: (date: string) => void;
}

// --------------- Helpers ---------------

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

const isInRange = (date: Date, min: Date | null, max: Date | null): boolean => {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
};

// --------------- Component ---------------

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  minDate,
  maxDate,
  isFocused = false,
  disabled = false,
  onChange,
}) => {
  const selectedDate = parseDate(value);
  const minD = parseDate(minDate);
  const maxD = parseDate(maxDate);

  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const [cursorDay, setCursorDay] = useState(selectedDate?.getDate() ?? today.getDate());

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
      setCursorDay(selectedDate.getDate());
    }
  }, [value]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const navigateMonth = useCallback(
    (delta: number) => {
      let m = viewMonth + delta;
      let y = viewYear;
      if (m < 0) {
        m = 11;
        y--;
      } else if (m > 11) {
        m = 0;
        y++;
      }
      setViewMonth(m);
      setViewYear(y);
      const maxDay = getDaysInMonth(y, m);
      if (cursorDay > maxDay) setCursorDay(maxDay);
    },
    [viewMonth, viewYear, cursorDay],
  );

  const selectDate = useCallback(() => {
    if (disabled) return;
    const d = new Date(viewYear, viewMonth, cursorDay);
    if (!isInRange(d, minD, maxD)) return;
    onChange?.(toISO(d));
  }, [disabled, viewYear, viewMonth, cursorDay, minD, maxD, onChange]);

  useInput(
    (_input, key) => {
      if (disabled) return;

      if (key.leftArrow) {
        setCursorDay((d) => {
          if (d <= 1) {
            navigateMonth(-1);
            return getDaysInMonth(
              viewMonth === 0 ? viewYear - 1 : viewYear,
              viewMonth === 0 ? 11 : viewMonth - 1,
            );
          }
          return d - 1;
        });
      } else if (key.rightArrow) {
        setCursorDay((d) => {
          if (d >= daysInMonth) {
            navigateMonth(1);
            return 1;
          }
          return d + 1;
        });
      } else if (key.upArrow) {
        setCursorDay((d) => {
          if (d - 7 < 1) {
            navigateMonth(-1);
            const prevDays = getDaysInMonth(
              viewMonth === 0 ? viewYear - 1 : viewYear,
              viewMonth === 0 ? 11 : viewMonth - 1,
            );
            return prevDays + (d - 7);
          }
          return d - 7;
        });
      } else if (key.downArrow) {
        setCursorDay((d) => {
          if (d + 7 > daysInMonth) {
            navigateMonth(1);
            return (d + 7) - daysInMonth;
          }
          return d + 7;
        });
      } else if (key.return) {
        selectDate();
      }
    },
    { isActive: isFocused },
  );

  // Build calendar grid
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

  const selectedDay = selectedDate && selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth
    ? selectedDate.getDate()
    : null;

  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth
    ? today.getDate()
    : null;

  return (
    <Box flexDirection="column">
      {/* Header: nav + month/year title */}
      <Box>
        <Text color="cyan">{'\u25C4'} </Text>
        <Text bold>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Text color="cyan"> {'\u25BA'}</Text>
      </Box>

      {/* Day-of-week header */}
      <Box>
        {DAYS.map((d) => (
          <Box key={d} width={4}>
            <Text dimColor>{d}</Text>
          </Box>
        ))}
      </Box>

      {/* Calendar grid */}
      {weeks.map((wk, wi) => (
        <Box key={wi}>
          {wk.map((day, di) => {
            if (day === null) {
              return (
                <Box key={`empty-${di}`} width={4}>
                  <Text> </Text>
                </Box>
              );
            }
            const isCursor = day === cursorDay && isFocused;
            const isSelected = day === selectedDay;
            const isToday = day === todayDay;
            const cellDate = new Date(viewYear, viewMonth, day);
            const outOfRange = !isInRange(cellDate, minD, maxD);

            return (
              <Box key={day} width={4}>
                <Text
                  bold={isSelected || isCursor}
                  inverse={isCursor && !disabled}
                  color={outOfRange ? 'gray' : isSelected ? 'green' : isToday ? 'cyan' : undefined}
                  dimColor={disabled || outOfRange}
                >
                  {String(day).padStart(2, ' ')}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Footer: selected date */}
      <Box marginTop={1}>
        <Text dimColor={disabled}>
          Selected: {value ?? 'none'}
        </Text>
      </Box>
    </Box>
  );
};

DatePicker.displayName = 'DatePicker';
export default DatePicker;
