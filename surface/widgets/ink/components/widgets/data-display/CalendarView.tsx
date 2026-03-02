// ============================================================
// Clef Surface Ink Widget — CalendarView
//
// Monthly calendar grid for displaying and navigating dates
// with optional event overlays. Supports keyboard-driven date
// navigation, previous/next month controls, and event listing
// per day cell. Terminal adaptation: ASCII grid with day numbers,
// highlighted today, arrow keys for navigation.
// See widget spec: repertoire/widgets/data-display/calendar-view.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface CalendarEvent {
  date: Date;
  label: string;
  id?: string;
}

// --------------- Props ---------------

export interface CalendarViewProps {
  /** Currently selected date. */
  selectedDate?: Date;
  /** Month to display (0-11). Defaults to current month. */
  month?: number;
  /** Year to display. Defaults to current year. */
  year?: number;
  /** Events to overlay on the calendar. */
  events?: CalendarEvent[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a date is selected. */
  onSelect?: (date: Date) => void;
  /** Callback when navigating to a different month. */
  onNavigate?: (month: number, year: number) => void;
}

// --------------- Helpers ---------------

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getEventsForDay(events: CalendarEvent[], year: number, month: number, day: number): CalendarEvent[] {
  return events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
}

// --------------- Component ---------------

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  month: monthProp,
  year: yearProp,
  events = [],
  isFocused = false,
  onSelect,
  onNavigate,
}) => {
  const today = new Date();
  const [displayMonth, setDisplayMonth] = useState(monthProp ?? today.getMonth());
  const [displayYear, setDisplayYear] = useState(yearProp ?? today.getFullYear());
  const [cursorDay, setCursorDay] = useState(
    selectedDate ? selectedDate.getDate() : today.getDate(),
  );

  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDay = getFirstDayOfWeek(displayYear, displayMonth);

  const navigateMonth = useCallback(
    (delta: number) => {
      let newMonth = displayMonth + delta;
      let newYear = displayYear;
      if (newMonth < 0) {
        newMonth = 11;
        newYear -= 1;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear += 1;
      }
      setDisplayMonth(newMonth);
      setDisplayYear(newYear);
      setCursorDay(1);
      onNavigate?.(newMonth, newYear);
    },
    [displayMonth, displayYear, onNavigate],
  );

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.leftArrow) {
        setCursorDay((d) => Math.max(1, d - 1));
      } else if (key.rightArrow) {
        setCursorDay((d) => Math.min(daysInMonth, d + 1));
      } else if (key.upArrow) {
        setCursorDay((d) => Math.max(1, d - 7));
      } else if (key.downArrow) {
        setCursorDay((d) => Math.min(daysInMonth, d + 7));
      } else if (input === '[' || key.pageUp) {
        navigateMonth(-1);
      } else if (input === ']' || key.pageDown) {
        navigateMonth(1);
      } else if (key.return || input === ' ') {
        onSelect?.(new Date(displayYear, displayMonth, cursorDay));
      }
    },
    { isActive: isFocused },
  );

  // Build the grid rows
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // Pad leading nulls
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad trailing nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const isToday = (day: number): boolean =>
    today.getFullYear() === displayYear &&
    today.getMonth() === displayMonth &&
    today.getDate() === day;

  const isSelected = (day: number): boolean =>
    selectedDate !== undefined && isSameDay(selectedDate, new Date(displayYear, displayMonth, day));

  return (
    <Box flexDirection="column">
      {/* Header: navigation and title */}
      <Box>
        <Text dimColor>{isFocused ? '[<] ' : '    '}</Text>
        <Text bold>
          {MONTH_NAMES[displayMonth]} {displayYear}
        </Text>
        <Text dimColor>{isFocused ? ' [>]' : ''}</Text>
      </Box>

      {/* Day-of-week headers */}
      <Box>
        {DAY_HEADERS.map((dh) => (
          <Box key={dh} width={4}>
            <Text dimColor>{dh}</Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Text dimColor>{'─'.repeat(28)}</Text>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <Box key={`week-${wi}`}>
          {week.map((day, di) => {
            if (day === null) {
              return (
                <Box key={`empty-${wi}-${di}`} width={4}>
                  <Text> </Text>
                </Box>
              );
            }

            const dayEvents = getEventsForDay(events, displayYear, displayMonth, day);
            const todayMark = isToday(day);
            const selectedMark = isSelected(day);
            const cursorMark = isFocused && cursorDay === day;
            const hasEvents = dayEvents.length > 0;

            const label = String(day).padStart(2, ' ');
            let prefix = ' ';
            let suffix = ' ';

            if (cursorMark) {
              prefix = '[';
              suffix = ']';
            } else if (selectedMark) {
              prefix = '(';
              suffix = ')';
            }

            const eventDot = hasEvents ? '*' : ' ';

            return (
              <Box key={`day-${day}`} width={4}>
                <Text
                  bold={todayMark || selectedMark}
                  color={cursorMark ? 'cyan' : todayMark ? 'green' : selectedMark ? 'yellow' : undefined}
                  inverse={cursorMark}
                >
                  {prefix}{label}{suffix}
                </Text>
                {hasEvents && <Text color="magenta">{eventDot}</Text>}
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Events for cursor day */}
      {isFocused && (() => {
        const dayEvents = getEventsForDay(events, displayYear, displayMonth, cursorDay);
        if (dayEvents.length === 0) return null;
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Events on {MONTH_NAMES[displayMonth]} {cursorDay}:</Text>
            {dayEvents.map((evt, i) => (
              <Box key={evt.id ?? `evt-${i}`} marginLeft={1}>
                <Text color="magenta">{'\u2022'} {evt.label}</Text>
              </Box>
            ))}
          </Box>
        );
      })()}
    </Box>
  );
};

CalendarView.displayName = 'CalendarView';
export default CalendarView;
