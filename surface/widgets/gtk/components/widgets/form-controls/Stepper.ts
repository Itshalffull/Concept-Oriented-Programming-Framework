// ============================================================
// Clef Surface GTK Widget — Stepper
//
// Numeric stepper with increment/decrement buttons flanking a
// value display. Uses Gtk.SpinButton for native step-by-step
// numeric input.
//
// Adapts the stepper.widget spec: anatomy (root, decrement,
// valueDisplay, increment), states (idle, min, max, disabled),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface StepperProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 stepper using SpinButton for numeric
 * increment/decrement control.
 */
export function createStepper(props: StepperProps = {}): Gtk.Widget {
  const {
    value = 0,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    onValueChange,
  } = props;

  const adjustment = new Gtk.Adjustment({
    value,
    lower: min,
    upper: max,
    stepIncrement: step,
    pageIncrement: step * 10,
    pageSize: 0,
  });

  const spinButton = new Gtk.SpinButton({
    adjustment,
    numeric: true,
    digits: 0,
  });

  spinButton.set_sensitive(!disabled);

  if (onValueChange) {
    spinButton.connect('value-changed', () => {
      onValueChange(spinButton.get_value());
    });
  }

  return spinButton;
}
