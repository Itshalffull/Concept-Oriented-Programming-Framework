// ============================================================
// Clef Surface GTK Widget — TextInput
//
// Single-line text entry field rendered with Gtk.Entry.
// Supports controlled and uncontrolled value, placeholder,
// label, disabled, read-only, and required-field states.
//
// Adapts the text-input.widget spec: anatomy (root, label,
// input, description, error, prefix, suffix, clearButton),
// states (empty, filled, idle, focused, valid, invalid,
// disabled, readOnly), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface TextInputProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  label?: string | null;
  required?: boolean;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Entry widget for single-line text input with
 * optional label, placeholder, and controlled/uncontrolled modes.
 */
export function createTextInput(props: TextInputProps = {}): Gtk.Widget {
  const {
    value = '',
    placeholder = '',
    disabled = false,
    readOnly = false,
    label = null,
    required = false,
    onValueChange,
    onSubmit,
  } = props;

  const entry = new Gtk.Entry({
    text: value,
    placeholderText: placeholder,
    editable: !readOnly,
  });

  entry.set_sensitive(!disabled);

  if (onValueChange) {
    entry.connect('changed', () => {
      onValueChange(entry.get_text());
    });
  }

  if (onSubmit) {
    entry.connect('activate', () => {
      onSubmit(entry.get_text());
    });
  }

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });
    const labelText = required ? `${label} <span foreground="red">*</span>` : label;
    const labelWidget = new Gtk.Label({
      label: labelText,
      useMarkup: required,
      xalign: 0,
    });
    box.append(labelWidget);
    box.append(entry);
    return box;
  }

  return entry;
}
