// ============================================================
// Clef Surface NativeScript Widget — Stepper
//
// Increment/decrement stepper control. Displays a current
// value between two buttons for stepping up or down. Supports
// min, max, step constraints and wrap-around mode.
// ============================================================

import { StackLayout, GridLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface StepperProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  wrap?: boolean;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export function createStepper(props: StepperProps = {}): StackLayout {
  const {
    value: initialValue = 0,
    min = 0,
    max = 100,
    step = 1,
    label,
    wrap = false,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = Math.max(min, Math.min(max, initialValue));

  const container = new StackLayout();
  container.className = 'clef-stepper';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-stepper-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  const controlRow = new GridLayout();
  controlRow.columns = 'auto, *, auto';
  controlRow.className = 'clef-stepper-controls';
  controlRow.horizontalAlignment = 'center';

  // Decrement button
  const decrementBtn = new Button();
  decrementBtn.col = 0;
  decrementBtn.text = '−';
  decrementBtn.className = 'clef-stepper-decrement';
  decrementBtn.width = 44;
  decrementBtn.height = 44;
  decrementBtn.fontSize = 20;
  decrementBtn.borderRadius = 22;
  decrementBtn.isEnabled = !disabled;

  // Value display
  const valueLabel = new Label();
  valueLabel.col = 1;
  valueLabel.text = String(currentValue);
  valueLabel.className = 'clef-stepper-value';
  valueLabel.textAlignment = 'center';
  valueLabel.verticalAlignment = 'middle';
  valueLabel.fontSize = 18;
  valueLabel.fontWeight = 'bold';
  valueLabel.color = new Color(accentColor);
  valueLabel.minWidth = 60;

  // Increment button
  const incrementBtn = new Button();
  incrementBtn.col = 2;
  incrementBtn.text = '+';
  incrementBtn.className = 'clef-stepper-increment';
  incrementBtn.width = 44;
  incrementBtn.height = 44;
  incrementBtn.fontSize = 20;
  incrementBtn.borderRadius = 22;
  incrementBtn.isEnabled = !disabled;

  function updateValue(newVal: number): void {
    if (wrap) {
      if (newVal > max) newVal = min;
      if (newVal < min) newVal = max;
    } else {
      newVal = Math.max(min, Math.min(max, newVal));
    }
    currentValue = newVal;
    valueLabel.text = String(currentValue);
    onChange?.(currentValue);
  }

  decrementBtn.on('tap', () => {
    if (!disabled) updateValue(currentValue - step);
  });

  incrementBtn.on('tap', () => {
    if (!disabled) updateValue(currentValue + step);
  });

  controlRow.addChild(decrementBtn);
  controlRow.addChild(valueLabel);
  controlRow.addChild(incrementBtn);
  container.addChild(controlRow);

  // Range indicator
  const rangeLabel = new Label();
  rangeLabel.text = `${min} – ${max}`;
  rangeLabel.className = 'clef-stepper-range';
  rangeLabel.textAlignment = 'center';
  rangeLabel.fontSize = 11;
  rangeLabel.opacity = 0.5;
  rangeLabel.marginTop = 2;
  container.addChild(rangeLabel);

  return container;
}

createStepper.displayName = 'Stepper';
export default createStepper;
