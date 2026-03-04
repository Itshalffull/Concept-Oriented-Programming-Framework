// ============================================================
// Clef Surface GTK Widget — CheckboxGroup
//
// Group of related checkboxes with an optional group label.
// Each option renders as a Gtk.CheckButton. Supports controlled
// selection tracking and disabled state.
//
// Adapts the checkbox-group.widget spec: anatomy (root, label,
// item), states (idle, disabled), and connect attributes to
// GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface CheckboxGroupOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface CheckboxGroupProps {
  options?: CheckboxGroupOption[];
  selected?: string[];
  label?: string | null;
  disabled?: boolean;
  onChange?: (selected: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 checkbox group with multiple Gtk.CheckButton
 * widgets and coordinated selection tracking.
 */
export function createCheckboxGroup(props: CheckboxGroupProps = {}): Gtk.Widget {
  const {
    options = [],
    selected = [],
    label = null,
    disabled = false,
    onChange,
  } = props;

  const currentSelected = new Set(selected);

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  if (label) {
    box.append(new Gtk.Label({ label, xalign: 0 }));
  }

  options.forEach((option) => {
    const checkButton = new Gtk.CheckButton({
      label: option.label,
      active: currentSelected.has(option.value),
    });
    checkButton.set_sensitive(!disabled && !option.disabled);

    checkButton.connect('toggled', () => {
      if (checkButton.get_active()) {
        currentSelected.add(option.value);
      } else {
        currentSelected.delete(option.value);
      }
      onChange?.([...currentSelected]);
    });

    box.append(checkButton);
  });

  return box;
}
