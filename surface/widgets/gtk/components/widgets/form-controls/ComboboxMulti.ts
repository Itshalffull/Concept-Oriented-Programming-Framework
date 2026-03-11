// ============================================================
// Clef Surface GTK Widget — ComboboxMulti
//
// Multi-selection combobox. Renders selected items as chips
// above a dropdown-style selector. Uses Gtk.FlowBox for
// selected chips and Gtk.ListBox in a Gtk.Popover for options.
//
// Adapts the combobox-multi.widget spec: anatomy (root, input,
// trigger, content, item, chip), states (open, closed), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ComboboxMultiOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface ComboboxMultiProps {
  values?: string[];
  options?: ComboboxMultiOption[];
  placeholder?: string;
  label?: string | null;
  disabled?: boolean;
  onValuesChange?: (values: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 multi-selection combobox with selected items
 * displayed as chips and a popover list for option selection.
 */
export function createComboboxMulti(props: ComboboxMultiProps = {}): Gtk.Widget {
  const {
    values = [],
    options = [],
    placeholder = 'Select items...',
    label = null,
    disabled = false,
    onValuesChange,
  } = props;

  const selected = new Set(values);

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  if (label) {
    container.append(new Gtk.Label({ label, xalign: 0 }));
  }

  // Selected chips display
  const chipFlow = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    homogeneous: false,
  });
  container.append(chipFlow);

  // Dropdown trigger button
  const triggerButton = new Gtk.Button({ label: placeholder });
  triggerButton.set_sensitive(!disabled);
  container.append(triggerButton);

  // Popover with option list
  const popover = new Gtk.Popover();
  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });

  function rebuildUI(): void {
    // Rebuild chips
    let child = chipFlow.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      chipFlow.remove(child);
      child = next;
    }

    selected.forEach((val) => {
      const opt = options.find((o) => o.value === val);
      if (opt) {
        const chipBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        chipBox.append(new Gtk.Label({ label: opt.label }));
        const removeBtn = new Gtk.Button({ iconName: 'window-close-symbolic' });
        removeBtn.get_style_context().add_class('flat');
        removeBtn.connect('clicked', () => {
          selected.delete(val);
          rebuildUI();
          onValuesChange?.([...selected]);
        });
        chipBox.append(removeBtn);
        chipFlow.insert(chipBox, -1);
      }
    });
  }

  options.forEach((option) => {
    const check = new Gtk.CheckButton({
      label: option.label,
      active: selected.has(option.value),
    });
    check.set_sensitive(!option.disabled);
    check.connect('toggled', () => {
      if (check.get_active()) {
        selected.add(option.value);
      } else {
        selected.delete(option.value);
      }
      rebuildUI();
      onValuesChange?.([...selected]);
    });
    listBox.append(check);
  });

  popover.set_child(listBox);
  popover.set_parent(triggerButton);
  triggerButton.connect('clicked', () => popover.popup());

  rebuildUI();
  return container;
}
