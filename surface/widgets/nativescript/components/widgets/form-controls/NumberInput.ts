// ============================================================
// Clef Surface NativeScript Widget — NumberInput
//
// Numeric input field with increment/decrement buttons and
// min/max/step constraints.
// ============================================================

import { StackLayout, Label, Button, TextField } from '@nativescript/core';

// --------------- Props ---------------

export interface NumberInputProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export function createNumberInput(props: NumberInputProps): StackLayout {
  const {
    value = 0,
    min = -Infinity,
    max = Infinity,
    step = 1,
    label,
    disabled = false,
    placeholder = '0',
    onChange,
  } = props;

  let current = value;

  const container = new StackLayout();
  container.className = 'clef-widget-number-input';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const row = new StackLayout();
  row.orientation = 'horizontal';
  row.verticalAlignment = 'middle';

  const decBtn = new Button();
  decBtn.text = '\u2212';
  decBtn.className = 'clef-number-input-dec';
  decBtn.isEnabled = !disabled && current > min;
  decBtn.accessibilityLabel = 'Decrease';
  decBtn.on('tap', () => {
    const next = current - step;
    if (next >= min) {
      current = next;
      field.text = String(current);
      onChange?.(current);
    }
  });
  row.addChild(decBtn);

  const field = new TextField();
  field.text = String(current);
  field.hint = placeholder;
  field.keyboardType = 'number';
  field.isEnabled = !disabled;
  field.className = 'clef-number-input-field';
  field.horizontalAlignment = 'center';
  field.on('textChange', (args: any) => {
    const num = parseFloat(args.object.text);
    if (!isNaN(num) && num >= min && num <= max) {
      current = num;
      onChange?.(current);
    }
  });
  row.addChild(field);

  const incBtn = new Button();
  incBtn.text = '+';
  incBtn.className = 'clef-number-input-inc';
  incBtn.isEnabled = !disabled && current < max;
  incBtn.accessibilityLabel = 'Increase';
  incBtn.on('tap', () => {
    const next = current + step;
    if (next <= max) {
      current = next;
      field.text = String(current);
      onChange?.(current);
    }
  });
  row.addChild(incBtn);

  container.addChild(row);
  return container;
}

export default createNumberInput;
