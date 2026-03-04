// ============================================================
// Clef Surface GTK Widget — Combobox
//
// Searchable single-selection dropdown. Uses Gtk.DropDown with
// a string model for option display, or Gtk.Entry + Gtk.Popover
// for filtering behavior.
//
// Adapts the combobox.widget spec: anatomy (root, label, input,
// trigger, content, item), states (open, closed, filtering),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ComboboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface ComboboxProps {
  value?: string | null;
  options?: ComboboxOption[];
  placeholder?: string;
  label?: string | null;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Combobox using Gtk.DropDown for single-selection
 * dropdown with label support.
 */
export function createCombobox(props: ComboboxProps = {}): Gtk.Widget {
  const {
    value = null,
    options = [],
    placeholder = 'Select...',
    label = null,
    disabled = false,
    onValueChange,
  } = props;

  const labels = options.map((o) => o.label);
  const stringList = Gtk.StringList.new(labels);
  const dropdown = new Gtk.DropDown({ model: stringList });

  // Set initial selection
  const selectedIdx = options.findIndex((o) => o.value === value);
  if (selectedIdx >= 0) {
    dropdown.set_selected(selectedIdx);
  }

  dropdown.set_sensitive(!disabled);

  dropdown.connect('notify::selected', () => {
    const idx = dropdown.get_selected();
    if (idx >= 0 && idx < options.length) {
      onValueChange?.(options[idx].value);
    }
  });

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });
    box.append(new Gtk.Label({ label, xalign: 0 }));
    box.append(dropdown);
    return box;
  }

  return dropdown;
}
