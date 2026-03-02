// ============================================================
// Clef Surface NativeScript Widget — CalendarView
//
// Month/week calendar display built with NativeScript GridLayout.
// Renders a navigable calendar with day cells, weekday headers,
// and optional date selection highlighting.
// ============================================================

import { StackLayout, GridLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type CalendarMode = 'month' | 'week';

// --------------- Props ---------------

export interface CalendarViewProps {
  mode?: CalendarMode;
  selectedDate?: Date;
  highlightedDates?: Date[];
  highlightColor?: string;
  todayColor?: string;
  headerColor?: string;
  showWeekNumbers?: boolean;
  startOfWeek?: 0 | 1;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (year: number, month: number) => void;
}

// --------------- Helpers ---------------

const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number, startOfWeek: number): number {
  const day = new Date(year, month, 1).getDay();
  return (day - startOfWeek + 7) % 7;
}

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

// --------------- Component ---------------

export function createCalendarView(props: CalendarViewProps = {}): StackLayout {
  const {
    mode = 'month',
    selectedDate = new Date(),
    highlightedDates = [],
    highlightColor = '#E3F2FD',
    todayColor = '#1976D2',
    headerColor = '#333333',
    showWeekNumbers = false,
    startOfWeek = 0,
    onDateSelect,
    onMonthChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-calendar-view';
  container.padding = 8;

  let displayYear = selectedDate.getFullYear();
  let displayMonth = selectedDate.getMonth();
  const today = new Date();
  const weekdays = startOfWeek === 1 ? WEEKDAYS_MON : WEEKDAYS_SUN;

  // --- Navigation header ---
  const navRow = new GridLayout();
  navRow.columns = 'auto, *, auto';
  navRow.marginBottom = 8;

  const prevBtn = new Button();
  prevBtn.text = '\u25C0';
  prevBtn.className = 'clef-calendar-nav-prev';
  prevBtn.fontSize = 14;
  prevBtn.backgroundColor = 'transparent' as any;
  prevBtn.on('tap', () => {
    displayMonth -= 1;
    if (displayMonth < 0) {
      displayMonth = 11;
      displayYear -= 1;
    }
    onMonthChange?.(displayYear, displayMonth);
  });
  GridLayout.setColumn(prevBtn, 0);
  navRow.addChild(prevBtn);

  const monthLabel = new Label();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  monthLabel.text = `${monthNames[displayMonth]} ${displayYear}`;
  monthLabel.className = 'clef-calendar-month-label';
  monthLabel.fontWeight = 'bold';
  monthLabel.fontSize = 16;
  monthLabel.color = new Color(headerColor);
  monthLabel.horizontalAlignment = 'center';
  monthLabel.verticalAlignment = 'middle';
  GridLayout.setColumn(monthLabel, 1);
  navRow.addChild(monthLabel);

  const nextBtn = new Button();
  nextBtn.text = '\u25B6';
  nextBtn.className = 'clef-calendar-nav-next';
  nextBtn.fontSize = 14;
  nextBtn.backgroundColor = 'transparent' as any;
  nextBtn.on('tap', () => {
    displayMonth += 1;
    if (displayMonth > 11) {
      displayMonth = 0;
      displayYear += 1;
    }
    onMonthChange?.(displayYear, displayMonth);
  });
  GridLayout.setColumn(nextBtn, 2);
  navRow.addChild(nextBtn);

  container.addChild(navRow);

  // --- Weekday headers ---
  const totalCols = showWeekNumbers ? 8 : 7;
  const headerGrid = new GridLayout();
  headerGrid.columns = showWeekNumbers
    ? 'auto, *, *, *, *, *, *, *'
    : '*, *, *, *, *, *, *';
  headerGrid.marginBottom = 4;

  if (showWeekNumbers) {
    const wnHeader = new Label();
    wnHeader.text = 'Wk';
    wnHeader.fontSize = 11;
    wnHeader.opacity = 0.5;
    wnHeader.horizontalAlignment = 'center';
    GridLayout.setColumn(wnHeader, 0);
    headerGrid.addChild(wnHeader);
  }

  weekdays.forEach((day, i) => {
    const dayLabel = new Label();
    dayLabel.text = day;
    dayLabel.fontSize = 12;
    dayLabel.fontWeight = 'bold';
    dayLabel.opacity = 0.7;
    dayLabel.horizontalAlignment = 'center';
    GridLayout.setColumn(dayLabel, showWeekNumbers ? i + 1 : i);
    headerGrid.addChild(dayLabel);
  });

  container.addChild(headerGrid);

  // --- Day cells ---
  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDayOffset = getFirstDayOfMonth(displayYear, displayMonth, startOfWeek);
  const totalDays = mode === 'week' ? 7 : firstDayOffset + daysInMonth;
  const rows = mode === 'week' ? 1 : Math.ceil(totalDays / 7);

  for (let row = 0; row < rows; row++) {
    const rowGrid = new GridLayout();
    rowGrid.columns = showWeekNumbers
      ? 'auto, *, *, *, *, *, *, *'
      : '*, *, *, *, *, *, *';
    rowGrid.height = 36;

    if (showWeekNumbers) {
      const dayIndex = row * 7 - firstDayOffset + 1;
      const refDate = new Date(displayYear, displayMonth, Math.max(1, dayIndex));
      const wnLabel = new Label();
      wnLabel.text = `${getWeekNumber(refDate)}`;
      wnLabel.fontSize = 10;
      wnLabel.opacity = 0.4;
      wnLabel.horizontalAlignment = 'center';
      wnLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(wnLabel, 0);
      rowGrid.addChild(wnLabel);
    }

    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      const dayNumber = cellIndex - firstDayOffset + 1;
      const isValidDay = dayNumber >= 1 && dayNumber <= daysInMonth;

      const cellLabel = new Label();
      cellLabel.horizontalAlignment = 'center';
      cellLabel.verticalAlignment = 'middle';
      cellLabel.fontSize = 14;
      cellLabel.borderRadius = 18;
      cellLabel.width = 36;
      cellLabel.height = 36;

      if (isValidDay) {
        const cellDate = new Date(displayYear, displayMonth, dayNumber);
        cellLabel.text = `${dayNumber}`;
        cellLabel.className = 'clef-calendar-day';

        if (isSameDay(cellDate, today)) {
          cellLabel.color = new Color('#FFFFFF');
          cellLabel.backgroundColor = todayColor as any;
          cellLabel.fontWeight = 'bold';
        } else if (isSameDay(cellDate, selectedDate)) {
          cellLabel.backgroundColor = highlightColor as any;
          cellLabel.fontWeight = 'bold';
        } else if (highlightedDates.some((d) => isSameDay(d, cellDate))) {
          cellLabel.backgroundColor = highlightColor as any;
          cellLabel.opacity = 0.8;
        }

        cellLabel.on('tap', () => onDateSelect?.(cellDate));
      } else {
        cellLabel.text = '';
      }

      GridLayout.setColumn(cellLabel, showWeekNumbers ? col + 1 : col);
      rowGrid.addChild(cellLabel);
    }

    container.addChild(rowGrid);
  }

  return container;
}

createCalendarView.displayName = 'CalendarView';
export default createCalendarView;
