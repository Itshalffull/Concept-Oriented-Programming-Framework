// ============================================================
// Clef Surface NativeScript Widget — DatePicker
//
// Date selection with calendar popup and text input.
// ============================================================

import { StackLayout, Label, TextField, Button, DatePicker as NSDatePicker } from '@nativescript/core';

export interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  minDate?: string;
  maxDate?: string;
  format?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  onChange?: (date: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createDatePicker(props: DatePickerProps): StackLayout {
  const {
    value: valueProp, defaultValue = '', minDate, maxDate,
    format = 'yyyy-MM-dd', label, placeholder = 'Select date...',
    disabled = false, required = false, name,
    onChange, size = 'md',
  } = props;

  let currentValue = valueProp ?? defaultValue;
  let isOpen = false;
  const container = new StackLayout();
  container.className = `clef-widget-date-picker clef-size-${size}`;

  if (label) {
    const lbl = new Label();
    lbl.text = required ? `${label} *` : label;
    container.addChild(lbl);
  }

  const trigger = new Button();
  trigger.text = currentValue || placeholder;
  trigger.isEnabled = !disabled;
  trigger.accessibilityLabel = label || 'Select date';
  trigger.on('tap', () => {
    if (disabled) return;
    isOpen = !isOpen;
    picker.visibility = isOpen ? 'visible' : 'collapsed';
  });
  container.addChild(trigger);

  const picker = new NSDatePicker();
  picker.visibility = 'collapsed';
  if (currentValue) picker.date = new Date(currentValue);
  if (minDate) picker.minDate = new Date(minDate);
  if (maxDate) picker.maxDate = new Date(maxDate);

  picker.on('dateChange', (args) => {
    const d = args.object.date;
    const formatted = d.toISOString().split('T')[0];
    currentValue = formatted;
    trigger.text = formatted;
    onChange?.(formatted);
  });
  container.addChild(picker);

  return container;
}

export default createDatePicker;
