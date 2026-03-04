// ============================================================
// Clef Surface GTK Widget — ChipInput
//
// Text input that converts entered values into removable chips.
// Combines a Gtk.Entry with a Gtk.FlowBox of chip widgets.
// Pressing Enter adds the current text as a new chip.
//
// Adapts the chip-input.widget spec: anatomy (root, input,
// chipList, chip, chipDelete), states (idle, focused), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface ChipInputProps {
  values?: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (values: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 chip input with a text entry that converts
 * submitted text into removable chip tags in a FlowBox.
 */
export function createChipInput(props: ChipInputProps = {}): Gtk.Widget {
  const {
    values = [],
    placeholder = 'Type and press Enter...',
    disabled = false,
    onChange,
  } = props;

  const currentValues = [...values];

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  const flowBox = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    homogeneous: false,
  });

  function rebuildChips(): void {
    let child = flowBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      flowBox.remove(child);
      child = next;
    }

    currentValues.forEach((val, idx) => {
      const chipBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
      });
      chipBox.append(new Gtk.Label({ label: val }));

      const removeBtn = new Gtk.Button({ iconName: 'window-close-symbolic' });
      removeBtn.get_style_context().add_class('flat');
      removeBtn.get_style_context().add_class('circular');
      removeBtn.connect('clicked', () => {
        currentValues.splice(idx, 1);
        rebuildChips();
        onChange?.([...currentValues]);
      });
      chipBox.append(removeBtn);

      flowBox.insert(chipBox, -1);
    });
  }

  rebuildChips();
  box.append(flowBox);

  const entry = new Gtk.Entry({ placeholderText: placeholder });
  entry.set_sensitive(!disabled);
  entry.connect('activate', () => {
    const text = entry.get_text().trim();
    if (text) {
      currentValues.push(text);
      entry.set_text('');
      rebuildChips();
      onChange?.([...currentValues]);
    }
  });
  box.append(entry);

  return box;
}
