// ============================================================
// Clef Surface GTK Widget — MultiSelect
//
// Multi-selection list with checkboxes. Renders options as a
// Gtk.ListBox where each row contains a Gtk.CheckButton.
//
// Adapts the multi-select.widget spec: anatomy (root, label,
// trigger, content, item, itemIndicator), states (open, closed),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface MultiSelectProps {
  values?: string[];
  options?: MultiSelectOption[];
  label?: string | null;
  disabled?: boolean;
  onValuesChange?: (values: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 multi-selection list with Gtk.CheckButton
 * rows inside a Gtk.ListBox.
 */
export function createMultiSelect(props: MultiSelectProps = {}): Gtk.Widget {
  const {
    values = [],
    options = [],
    label = null,
    disabled = false,
    onValuesChange,
  } = props;

  const selected = new Set(values);

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  if (label) {
    box.append(new Gtk.Label({ label, xalign: 0 }));
  }

  const listBox = new Gtk.ListBox({
    selectionMode: Gtk.SelectionMode.NONE,
  });
  listBox.get_style_context().add_class('boxed-list');

  options.forEach((option) => {
    const check = new Gtk.CheckButton({
      label: option.label,
      active: selected.has(option.value),
    });
    check.set_sensitive(!disabled && !option.disabled);

    check.connect('toggled', () => {
      if (check.get_active()) {
        selected.add(option.value);
      } else {
        selected.delete(option.value);
      }
      onValuesChange?.([...selected]);
    });

    listBox.append(check);
  });

  box.append(listBox);
  return box;
}
