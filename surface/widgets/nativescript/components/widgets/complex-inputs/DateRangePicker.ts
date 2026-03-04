// ============================================================
// Clef Surface NativeScript Widget — DateRangePicker
//
// Date range selection with start/end date pickers.
// ============================================================

import { StackLayout, Label, Button, DatePicker as NSDatePicker } from '@nativescript/core';

export interface DateRangePreset { label: string; startDate: string; endDate: string; }

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  minDate?: string;
  maxDate?: string;
  presets?: DateRangePreset[];
  label?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  onChange?: (range: { start: string; end: string }) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createDateRangePicker(props: DateRangePickerProps): StackLayout {
  const {
    startDate: startProp, endDate: endProp, minDate, maxDate,
    presets = [], label, disabled = false, required = false,
    name, onChange, size = 'md',
  } = props;

  let start = startProp || '';
  let end = endProp || '';
  const container = new StackLayout();
  container.className = `clef-widget-date-range-picker clef-size-${size}`;

  if (label) {
    const lbl = new Label();
    lbl.text = required ? `${label} *` : label;
    container.addChild(lbl);
  }

  const display = new Label();
  display.text = start && end ? `${start} - ${end}` : 'Select date range...';
  container.addChild(display);

  if (presets.length > 0) {
    const presetRow = new StackLayout();
    presetRow.orientation = 'horizontal';
    for (const preset of presets) {
      const btn = new Button();
      btn.text = preset.label;
      btn.on('tap', () => {
        start = preset.startDate;
        end = preset.endDate;
        display.text = `${start} - ${end}`;
        onChange?.({ start, end });
      });
      presetRow.addChild(btn);
    }
    container.addChild(presetRow);
  }

  return container;
}

export default createDateRangePicker;
