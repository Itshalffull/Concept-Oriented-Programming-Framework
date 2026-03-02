// ============================================================
// Clef Surface NativeScript Widget — NumberInput
//
// Numeric input field with optional increment/decrement
// stepper buttons. Supports min, max, step constraints,
// and live validation of numeric values.
// ============================================================

import { StackLayout, GridLayout, Label, TextField, Button, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface NumberInputProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  showStepper?: boolean;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export function createNumberInput(props: NumberInputProps = {}): StackLayout {
  const {
    value: initialValue = 0,
    min = -Infinity,
    max = Infinity,
    step = 1,
    label,
    placeholder = '0',
    showStepper = true,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = Math.max(min, Math.min(max, initialValue));

  const container = new StackLayout();
  container.className = 'clef-number-input';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-number-input-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  const inputRow = new GridLayout();
  inputRow.className = 'clef-number-input-row';

  if (showStepper) {
    inputRow.columns = 'auto, *, auto';
  } else {
    inputRow.columns = '*';
  }

  function clamp(v: number): number {
    return Math.max(min, Math.min(max, v));
  }

  function updateDisplay(): void {
    textField.text = String(currentValue);
  }

  // Decrement button
  if (showStepper) {
    const decrementBtn = new Button();
    decrementBtn.col = 0;
    decrementBtn.text = '−';
    decrementBtn.className = 'clef-number-input-decrement';
    decrementBtn.width = 40;
    decrementBtn.height = 40;
    decrementBtn.fontSize = 18;
    decrementBtn.isEnabled = !disabled;

    decrementBtn.on('tap', () => {
      if (disabled) return;
      currentValue = clamp(currentValue - step);
      updateDisplay();
      onChange?.(currentValue);
    });

    inputRow.addChild(decrementBtn);
  }

  // Text field
  const textField = new TextField();
  textField.col = showStepper ? 1 : 0;
  textField.className = 'clef-number-input-field';
  textField.text = String(currentValue);
  textField.hint = placeholder;
  textField.keyboardType = 'number';
  textField.textAlignment = 'center';
  textField.isEnabled = !disabled;

  textField.on('textChange', () => {
    const parsed = parseFloat(textField.text || '0');
    if (!isNaN(parsed)) {
      currentValue = clamp(parsed);
      onChange?.(currentValue);
    }
  });

  inputRow.addChild(textField);

  // Increment button
  if (showStepper) {
    const incrementBtn = new Button();
    incrementBtn.col = 2;
    incrementBtn.text = '+';
    incrementBtn.className = 'clef-number-input-increment';
    incrementBtn.width = 40;
    incrementBtn.height = 40;
    incrementBtn.fontSize = 18;
    incrementBtn.isEnabled = !disabled;

    incrementBtn.on('tap', () => {
      if (disabled) return;
      currentValue = clamp(currentValue + step);
      updateDisplay();
      onChange?.(currentValue);
    });

    inputRow.addChild(incrementBtn);
  }

  // Range hint
  if (min !== -Infinity || max !== Infinity) {
    const rangeLabel = new Label();
    rangeLabel.className = 'clef-number-input-range';
    const minStr = min === -Infinity ? '−∞' : String(min);
    const maxStr = max === Infinity ? '∞' : String(max);
    rangeLabel.text = `Range: ${minStr} – ${maxStr}`;
    rangeLabel.fontSize = 11;
    rangeLabel.opacity = 0.5;
    rangeLabel.marginTop = 2;
    container.addChild(inputRow);
    container.addChild(rangeLabel);
  } else {
    container.addChild(inputRow);
  }

  return container;
}

createNumberInput.displayName = 'NumberInput';
export default createNumberInput;
