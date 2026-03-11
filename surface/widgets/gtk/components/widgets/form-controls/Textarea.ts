// ============================================================
// Clef Surface GTK Widget — Textarea
//
// Multi-line text entry field. Uses Gtk.TextView inside a
// Gtk.ScrolledWindow with optional label, placeholder, and
// character count display.
//
// Adapts the textarea.widget spec: anatomy (root, label,
// input, counter), states (empty, filled, focused, disabled,
// readOnly), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface TextareaProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  label?: string | null;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 multi-line text input using Gtk.TextView inside
 * a ScrolledWindow with optional label and character counter.
 */
export function createTextarea(props: TextareaProps = {}): Gtk.Widget {
  const {
    value = '',
    placeholder = '',
    disabled = false,
    readOnly = false,
    label = null,
    required = false,
    rows = 4,
    maxLength,
    onValueChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  if (label) {
    const labelText = required ? `${label} <span foreground="red">*</span>` : label;
    container.append(new Gtk.Label({
      label: labelText,
      useMarkup: required,
      xalign: 0,
    }));
  }

  const scrolled = new Gtk.ScrolledWindow({
    minContentHeight: rows * 20,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });

  const textView = new Gtk.TextView({
    wrapMode: Gtk.WrapMode.WORD_CHAR,
    editable: !readOnly,
  });

  const buffer = textView.get_buffer();
  buffer.set_text(value, value.length);
  textView.set_sensitive(!disabled);

  if (onValueChange) {
    buffer.connect('changed', () => {
      const [start, end] = [buffer.get_start_iter(), buffer.get_end_iter()];
      const text = buffer.get_text(start, end, false);
      onValueChange(text);
    });
  }

  scrolled.set_child(textView);
  container.append(scrolled);

  if (maxLength !== undefined) {
    const counter = new Gtk.Label({
      label: `${value.length}/${maxLength}`,
      xalign: 1,
    });
    counter.get_style_context().add_class('dim-label');
    container.append(counter);
  }

  return container;
}
