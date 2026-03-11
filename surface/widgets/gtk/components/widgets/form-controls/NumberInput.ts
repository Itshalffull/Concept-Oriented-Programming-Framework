// ============================================================
// Clef Surface GTK Widget — NumberInput
//
// Numeric entry field with optional increment/decrement buttons.
// Uses Gtk.SpinButton for native numeric input with configurable
// range, step, and precision.
//
// Adapts the number-input.widget spec: anatomy (root, label,
// input, increment, decrement), states (idle, focused, disabled),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface NumberInputProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  label?: string | null;
  disabled?: boolean;
  onValueChange?: (value: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 SpinButton for numeric input with configurable
 * range, step size, and decimal precision.
 */
export function createNumberInput(props: NumberInputProps = {}): Gtk.Widget {
  const {
    value = 0,
    min = -Infinity,
    max = Infinity,
    step = 1,
    digits = 0,
    label = null,
    disabled = false,
    onValueChange,
  } = props;

  const adjustment = new Gtk.Adjustment({
    value,
    lower: min === -Infinity ? -999999 : min,
    upper: max === Infinity ? 999999 : max,
    stepIncrement: step,
    pageIncrement: step * 10,
    pageSize: 0,
  });

  const spinButton = new Gtk.SpinButton({
    adjustment,
    digits,
    numeric: true,
  });

  spinButton.set_sensitive(!disabled);

  if (onValueChange) {
    spinButton.connect('value-changed', () => {
      onValueChange(spinButton.get_value());
    });
  }

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });
    box.append(new Gtk.Label({ label, xalign: 0 }));
    box.append(spinButton);
    return box;
  }

  return spinButton;
}
