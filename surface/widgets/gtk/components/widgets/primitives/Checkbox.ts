// ============================================================
// Clef Surface GTK Widget — Checkbox
//
// Boolean toggle control rendered with Gtk.CheckButton.
// Supports checked, unchecked, and indeterminate states with
// an optional label and required-field indicator.
//
// Adapts the checkbox.widget spec: anatomy (root, input,
// control, indicator, label), states (unchecked, checked,
// indeterminate, disabled, focused), and connect attributes
// (data-part, data-state, data-disabled) to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label?: string | null;
  required?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 CheckButton with optional label, supporting
 * checked, unchecked, and indeterminate tri-state.
 */
export function createCheckbox(props: CheckboxProps = {}): Gtk.Widget {
  const {
    checked = false,
    indeterminate = false,
    disabled = false,
    label = null,
    required = false,
    onCheckedChange,
  } = props;

  const displayLabel = label ? (required ? `${label} *` : label) : undefined;
  const checkButton = new Gtk.CheckButton({
    label: displayLabel,
    active: checked,
  });

  if (indeterminate) {
    checkButton.set_inconsistent(true);
  }

  checkButton.set_sensitive(!disabled);

  if (onCheckedChange) {
    checkButton.connect('toggled', () => {
      onCheckedChange(checkButton.get_active());
    });
  }

  return checkButton;
}
