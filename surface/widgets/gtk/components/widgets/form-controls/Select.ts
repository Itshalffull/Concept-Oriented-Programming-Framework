// ============================================================
// Clef Surface GTK Widget — Select
//
// Dropdown single-choice selector. Uses Gtk.DropDown with a
// StringList model for option display. Shows a trigger displaying
// the selected value with a dropdown arrow.
//
// Adapts the select.widget spec: anatomy (root, label, trigger,
// valueDisplay, indicator, content, item, itemIndicator) to
// GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface SelectProps {
  value?: string | null;
  options?: SelectOption[];
  placeholder?: string;
  label?: string | null;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 dropdown selector using Gtk.DropDown with a
 * StringList model for single-choice selection.
 */
export function createSelect(props: SelectProps = {}): Gtk.Widget {
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
