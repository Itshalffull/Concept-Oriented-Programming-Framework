// ============================================================
// Clef Surface GTK Widget — CronEditor
//
// Cron expression editor with visual schedule builder and
// human-readable preview of the cron expression.
//
// Adapts the cron-editor.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CronEditorProps {
  value?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createCronEditor(props: CronEditorProps = {}): Gtk.Widget {
  const { value = '* * * * *', disabled = false, onValueChange } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: 'Cron Expression', xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  const entry = new Gtk.Entry({ text: value, placeholderText: '* * * * *' });
  entry.set_sensitive(!disabled);
  entry.get_style_context().add_class('monospace');
  if (onValueChange) entry.connect('changed', () => onValueChange(entry.get_text()));
  box.append(entry);

  // Field labels
  const fields = ['Minute', 'Hour', 'Day', 'Month', 'Weekday'];
  const fieldBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  fields.forEach((f) => {
    const label = new Gtk.Label({ label: f, hexpand: true });
    label.get_style_context().add_class('dim-label');
    fieldBox.append(label);
  });
  box.append(fieldBox);

  // Preview
  const preview = new Gtk.Label({ label: `Schedule: ${value}`, xalign: 0, wrap: true });
  preview.get_style_context().add_class('dim-label');
  box.append(preview);

  return box;
}
