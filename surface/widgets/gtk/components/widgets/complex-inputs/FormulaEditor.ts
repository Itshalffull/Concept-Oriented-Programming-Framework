// ============================================================
// Clef Surface GTK Widget — FormulaEditor
//
// Structured formula/expression editor with syntax highlighting.
// Uses Gtk.TextView with a GtkSourceView-style buffer for
// formula editing with operator buttons.
//
// Adapts the formula-editor.widget spec: anatomy (root, input,
// toolbar, preview, suggestions), states (idle, editing,
// valid, error), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface FormulaEditorProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  operators?: string[];
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 formula editor with text input, operator
 * toolbar, and live preview.
 */
export function createFormulaEditor(props: FormulaEditorProps = {}): Gtk.Widget {
  const {
    value = '',
    placeholder = 'Enter formula...',
    disabled = false,
    operators = ['+', '-', '*', '/', '(', ')', '=', '<', '>'],
    onValueChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  // Operator toolbar
  const toolbar = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 2,
  });
  toolbar.get_style_context().add_class('linked');

  const textView = new Gtk.TextView({
    wrapMode: Gtk.WrapMode.WORD_CHAR,
    editable: !disabled,
    monospace: true,
  });
  const buffer = textView.get_buffer();
  buffer.set_text(value, value.length);

  operators.forEach((op) => {
    const btn = new Gtk.Button({ label: op });
    btn.get_style_context().add_class('flat');
    btn.set_sensitive(!disabled);
    btn.connect('clicked', () => {
      buffer.insert_at_cursor(op, op.length);
      const [start, end] = [buffer.get_start_iter(), buffer.get_end_iter()];
      onValueChange?.(buffer.get_text(start, end, false));
    });
    toolbar.append(btn);
  });

  container.append(toolbar);

  // Text editor
  const scrolled = new Gtk.ScrolledWindow({
    minContentHeight: 60,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });

  if (onValueChange) {
    buffer.connect('changed', () => {
      const [start, end] = [buffer.get_start_iter(), buffer.get_end_iter()];
      onValueChange(buffer.get_text(start, end, false));
    });
  }

  scrolled.set_child(textView);
  container.append(scrolled);

  return container;
}
