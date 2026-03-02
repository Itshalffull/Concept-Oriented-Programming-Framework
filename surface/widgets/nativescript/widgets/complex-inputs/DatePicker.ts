// ============================================================
// Clef Surface NativeScript Widget — DatePicker
//
// Date selection control with a text input trigger, inline
// calendar grid showing the current month, navigation buttons
// for month switching, and today/clear action buttons.
//
// Adapts the date-picker.widget spec: anatomy (root, trigger,
// calendar, dayCell, header, navigation), states (open, selected,
// disabled, focus), and connect attributes to NativeScript
// rendering via GridLayout calendar and tap-based selection.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  TextField,
} from '@nativescript/core';

// --------------- Helpers ---------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --------------- Props ---------------

export interface DatePickerProps {
  value?: string;
  minDate?: string;
  maxDate?: string;
  enabled?: boolean;
  placeholder?: string;
  onDateChange?: (date: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript date picker with a text field trigger,
 * month/year navigation, a 7-column calendar grid, and
 * today/clear action buttons.
 */
export function createDatePicker(props: DatePickerProps = {}): StackLayout {
  const {
    value,
    minDate,
    maxDate,
    enabled = true,
    placeholder = 'Select date...',
    onDateChange,
  } = props;

  let currentDate = value ? new Date(value) : null;
  let viewYear = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  let viewMonth = currentDate ? currentDate.getMonth() : new Date().getMonth();

  const container = new StackLayout();
  container.className = 'clef-widget-date-picker';
  container.padding = 8;

  // -- Text input trigger --
  const input = new TextField();
  input.text = currentDate ? formatDate(currentDate) : '';
  input.hint = placeholder;
  input.editable = false;
  input.isEnabled = enabled;
  input.borderWidth = 1;
  input.borderColor = '#CCCCCC';
  input.borderRadius = 4;
  input.padding = 8;
  input.marginBottom = 8;
  container.addChild(input);

  // -- Calendar panel --
  const calendarPanel = new StackLayout();
  calendarPanel.className = 'clef-date-picker-calendar';
  calendarPanel.borderWidth = 1;
  calendarPanel.borderColor = '#E0E0E0';
  calendarPanel.borderRadius = 8;
  calendarPanel.padding = 8;

  // -- Month navigation header --
  const header = new GridLayout();
  header.columns = 'auto, *, auto';
  header.rows = 'auto';
  header.marginBottom = 8;

  const prevBtn = new Button();
  prevBtn.text = '\u25C0';
  prevBtn.fontSize = 14;
  prevBtn.borderWidth = 0;
  prevBtn.backgroundColor = 'transparent' as any;
  prevBtn.col = 0;

  const monthLabel = new Label();
  monthLabel.horizontalAlignment = 'center';
  monthLabel.verticalAlignment = 'middle';
  monthLabel.fontWeight = 'bold';
  monthLabel.fontSize = 16;
  monthLabel.col = 1;

  const nextBtn = new Button();
  nextBtn.text = '\u25B6';
  nextBtn.fontSize = 14;
  nextBtn.borderWidth = 0;
  nextBtn.backgroundColor = 'transparent' as any;
  nextBtn.col = 2;

  header.addChild(prevBtn);
  header.addChild(monthLabel);
  header.addChild(nextBtn);
  calendarPanel.addChild(header);

  // -- Day-of-week header --
  const dayHeaderGrid = new GridLayout();
  dayHeaderGrid.columns = '*, *, *, *, *, *, *';
  dayHeaderGrid.rows = 'auto';
  dayHeaderGrid.marginBottom = 4;

  DAY_NAMES.forEach((day, i) => {
    const lbl = new Label();
    lbl.text = day;
    lbl.fontSize = 11;
    lbl.fontWeight = 'bold';
    lbl.horizontalAlignment = 'center';
    lbl.opacity = 0.6;
    lbl.col = i;
    dayHeaderGrid.addChild(lbl);
  });
  calendarPanel.addChild(dayHeaderGrid);

  // -- Day cells container --
  const dayCellsContainer = new StackLayout();
  calendarPanel.addChild(dayCellsContainer);

  function renderCalendar(): void {
    dayCellsContainer.removeChildren();
    monthLabel.text = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const totalDays = daysInMonth(viewYear, viewMonth);
    const startDay = firstDayOfMonth(viewYear, viewMonth);
    let dayIndex = 0;
    const totalCells = startDay + totalDays;
    const rowCount = Math.ceil(totalCells / 7);

    for (let row = 0; row < rowCount; row++) {
      const rowGrid = new GridLayout();
      rowGrid.columns = '*, *, *, *, *, *, *';
      rowGrid.rows = 'auto';
      rowGrid.height = 36;

      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;
        const dayNum = cellIndex - startDay + 1;

        const cell = new Label();
        cell.horizontalAlignment = 'center';
        cell.verticalAlignment = 'middle';
        cell.fontSize = 14;
        cell.col = col;

        if (dayNum >= 1 && dayNum <= totalDays) {
          cell.text = String(dayNum);
          const cellDate = new Date(viewYear, viewMonth, dayNum);
          const cellStr = formatDate(cellDate);

          let isDisabled = false;
          if (minDate && cellStr < minDate) isDisabled = true;
          if (maxDate && cellStr > maxDate) isDisabled = true;

          if (isDisabled) {
            cell.opacity = 0.3;
          } else if (currentDate && cellStr === formatDate(currentDate)) {
            cell.fontWeight = 'bold';
            cell.backgroundColor = '#2196F3' as any;
            cell.color = '#FFFFFF' as any;
            cell.borderRadius = 18;
          }

          if (enabled && !isDisabled) {
            cell.on('tap', () => {
              currentDate = cellDate;
              input.text = formatDate(currentDate);
              renderCalendar();
              if (onDateChange) onDateChange(cellStr);
            });
          }
        }

        rowGrid.addChild(cell);
        dayIndex++;
      }

      dayCellsContainer.addChild(rowGrid);
    }
  }

  prevBtn.on('tap', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });

  nextBtn.on('tap', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  // -- Action buttons --
  const actions = new GridLayout();
  actions.columns = '*, *';
  actions.rows = 'auto';
  actions.marginTop = 8;

  const todayBtn = new Button();
  todayBtn.text = 'Today';
  todayBtn.fontSize = 13;
  todayBtn.col = 0;
  todayBtn.on('tap', () => {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    currentDate = today;
    input.text = formatDate(today);
    renderCalendar();
    if (onDateChange) onDateChange(formatDate(today));
  });

  const clearBtn = new Button();
  clearBtn.text = 'Clear';
  clearBtn.fontSize = 13;
  clearBtn.col = 1;
  clearBtn.on('tap', () => {
    currentDate = null;
    input.text = '';
    renderCalendar();
    if (onDateChange) onDateChange('');
  });

  actions.addChild(todayBtn);
  actions.addChild(clearBtn);
  calendarPanel.addChild(actions);

  container.addChild(calendarPanel);

  renderCalendar();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createDatePicker.displayName = 'DatePicker';
export default createDatePicker;
