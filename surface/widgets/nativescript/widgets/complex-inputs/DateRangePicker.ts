// ============================================================
// Clef Surface NativeScript Widget — DateRangePicker
//
// Dual-date selection control for picking a start and end date.
// Renders two inline calendars side-by-side with shared month
// navigation, highlighted range visualization, and preset
// range shortcuts (today, last 7 days, last 30 days, etc.).
//
// Adapts the date-range-picker.widget spec: anatomy (root,
// startTrigger, endTrigger, calendar, range highlight),
// states (selecting-start, selecting-end, complete), and
// connect attributes to NativeScript layout containers.
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

const DAY_ABBRS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateBetween(target: string, start: string, end: string): boolean {
  return target >= start && target <= end;
}

// --------------- Props ---------------

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  onRangeChange?: (start: string, end: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript date range picker with dual calendar
 * views, range highlighting, preset shortcuts, and start/end
 * text fields.
 */
export function createDateRangePicker(props: DateRangePickerProps = {}): StackLayout {
  const {
    startDate: initStart,
    endDate: initEnd,
    enabled = true,
    onRangeChange,
  } = props;

  let rangeStart: Date | null = initStart ? new Date(initStart) : null;
  let rangeEnd: Date | null = initEnd ? new Date(initEnd) : null;
  let selectingStart = true;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();

  const container = new StackLayout();
  container.className = 'clef-widget-date-range-picker';
  container.padding = 8;

  // -- Start / End display fields --
  const fieldRow = new GridLayout();
  fieldRow.columns = '*, auto, *';
  fieldRow.rows = 'auto';
  fieldRow.marginBottom = 8;

  const startField = new TextField();
  startField.hint = 'Start date';
  startField.text = rangeStart ? fmtDate(rangeStart) : '';
  startField.editable = false;
  startField.borderWidth = 1;
  startField.borderColor = '#2196F3';
  startField.borderRadius = 4;
  startField.padding = 6;
  startField.col = 0;

  const arrow = new Label();
  arrow.text = ' \u2192 ';
  arrow.verticalAlignment = 'middle';
  arrow.horizontalAlignment = 'center';
  arrow.col = 1;

  const endField = new TextField();
  endField.hint = 'End date';
  endField.text = rangeEnd ? fmtDate(rangeEnd) : '';
  endField.editable = false;
  endField.borderWidth = 1;
  endField.borderColor = '#CCCCCC';
  endField.borderRadius = 4;
  endField.padding = 6;
  endField.col = 2;

  fieldRow.addChild(startField);
  fieldRow.addChild(arrow);
  fieldRow.addChild(endField);
  container.addChild(fieldRow);

  // -- Toggle indicator --
  const modeLabel = new Label();
  modeLabel.text = 'Selecting: start date';
  modeLabel.fontSize = 12;
  modeLabel.opacity = 0.7;
  modeLabel.horizontalAlignment = 'center';
  modeLabel.marginBottom = 8;
  container.addChild(modeLabel);

  // -- Calendar navigation --
  const navRow = new GridLayout();
  navRow.columns = 'auto, *, auto';
  navRow.rows = 'auto';
  navRow.marginBottom = 4;

  const prevBtn = new Button();
  prevBtn.text = '\u25C0';
  prevBtn.fontSize = 14;
  prevBtn.backgroundColor = 'transparent' as any;
  prevBtn.borderWidth = 0;
  prevBtn.col = 0;

  const monthTitle = new Label();
  monthTitle.fontWeight = 'bold';
  monthTitle.fontSize = 16;
  monthTitle.horizontalAlignment = 'center';
  monthTitle.verticalAlignment = 'middle';
  monthTitle.col = 1;

  const nextBtn = new Button();
  nextBtn.text = '\u25B6';
  nextBtn.fontSize = 14;
  nextBtn.backgroundColor = 'transparent' as any;
  nextBtn.borderWidth = 0;
  nextBtn.col = 2;

  navRow.addChild(prevBtn);
  navRow.addChild(monthTitle);
  navRow.addChild(nextBtn);
  container.addChild(navRow);

  // -- Day header --
  const dayHeader = new GridLayout();
  dayHeader.columns = '*, *, *, *, *, *, *';
  dayHeader.rows = 'auto';
  dayHeader.marginBottom = 2;
  DAY_ABBRS.forEach((d, i) => {
    const lbl = new Label();
    lbl.text = d;
    lbl.fontSize = 11;
    lbl.fontWeight = 'bold';
    lbl.horizontalAlignment = 'center';
    lbl.opacity = 0.6;
    lbl.col = i;
    dayHeader.addChild(lbl);
  });
  container.addChild(dayHeader);

  // -- Day cells container --
  const dayCells = new StackLayout();
  container.addChild(dayCells);

  function renderCalendar(): void {
    dayCells.removeChildren();
    monthTitle.text = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const total = daysInMonth(viewYear, viewMonth);
    const start = firstDayOfMonth(viewYear, viewMonth);
    const rowCount = Math.ceil((start + total) / 7);

    for (let row = 0; row < rowCount; row++) {
      const rowGrid = new GridLayout();
      rowGrid.columns = '*, *, *, *, *, *, *';
      rowGrid.rows = 'auto';
      rowGrid.height = 36;

      for (let col = 0; col < 7; col++) {
        const idx = row * 7 + col;
        const dayNum = idx - start + 1;
        const cell = new Label();
        cell.horizontalAlignment = 'center';
        cell.verticalAlignment = 'middle';
        cell.fontSize = 13;
        cell.col = col;

        if (dayNum >= 1 && dayNum <= total) {
          cell.text = String(dayNum);
          const cellDate = new Date(viewYear, viewMonth, dayNum);
          const cellStr = fmtDate(cellDate);

          const startStr = rangeStart ? fmtDate(rangeStart) : '';
          const endStr = rangeEnd ? fmtDate(rangeEnd) : '';

          if (cellStr === startStr || cellStr === endStr) {
            cell.backgroundColor = '#2196F3' as any;
            cell.color = '#FFFFFF' as any;
            cell.borderRadius = 18;
            cell.fontWeight = 'bold';
          } else if (startStr && endStr && dateBetween(cellStr, startStr, endStr)) {
            cell.backgroundColor = '#BBDEFB' as any;
            cell.borderRadius = 4;
          }

          if (enabled) {
            cell.on('tap', () => {
              if (selectingStart) {
                rangeStart = cellDate;
                rangeEnd = null;
                startField.text = cellStr;
                startField.borderColor = '#CCCCCC';
                endField.text = '';
                endField.borderColor = '#2196F3';
                selectingStart = false;
                modeLabel.text = 'Selecting: end date';
              } else {
                if (rangeStart && cellDate < rangeStart) {
                  rangeEnd = rangeStart;
                  rangeStart = cellDate;
                } else {
                  rangeEnd = cellDate;
                }
                startField.text = rangeStart ? fmtDate(rangeStart) : '';
                endField.text = rangeEnd ? fmtDate(rangeEnd) : '';
                endField.borderColor = '#CCCCCC';
                startField.borderColor = '#2196F3';
                selectingStart = true;
                modeLabel.text = 'Selecting: start date';
                if (onRangeChange && rangeStart && rangeEnd) {
                  onRangeChange(fmtDate(rangeStart), fmtDate(rangeEnd));
                }
              }
              renderCalendar();
            });
          }
        }

        rowGrid.addChild(cell);
      }

      dayCells.addChild(rowGrid);
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

  // -- Preset shortcuts --
  const presetRow = new GridLayout();
  presetRow.columns = '*, *, *';
  presetRow.rows = 'auto';
  presetRow.marginTop = 8;

  const presets: Array<{ label: string; days: number }> = [
    { label: 'Last 7d', days: 7 },
    { label: 'Last 30d', days: 30 },
    { label: 'Last 90d', days: 90 },
  ];

  presets.forEach((p, i) => {
    const btn = new Button();
    btn.text = p.label;
    btn.fontSize = 12;
    btn.col = i;
    btn.on('tap', () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - p.days);
      rangeStart = start;
      rangeEnd = end;
      startField.text = fmtDate(start);
      endField.text = fmtDate(end);
      viewYear = end.getFullYear();
      viewMonth = end.getMonth();
      selectingStart = true;
      modeLabel.text = 'Selecting: start date';
      renderCalendar();
      if (onRangeChange) onRangeChange(fmtDate(start), fmtDate(end));
    });
    presetRow.addChild(btn);
  });

  container.addChild(presetRow);

  renderCalendar();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createDateRangePicker.displayName = 'DateRangePicker';
export default createDateRangePicker;
