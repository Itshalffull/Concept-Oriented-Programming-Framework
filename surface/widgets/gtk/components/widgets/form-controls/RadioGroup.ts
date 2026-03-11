// ============================================================
// Clef Surface GTK Widget — RadioGroup
//
// Group of mutually exclusive radio buttons. Each option
// renders as a Gtk.CheckButton in radio group mode.
//
// Adapts the radio-group.widget spec: anatomy (root, label,
// item, indicator), states (idle, disabled), and connect
// attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface RadioGroupOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface RadioGroupProps {
  value?: string | null;
  options?: RadioGroupOption[];
  label?: string | null;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 radio group with mutually exclusive
 * Gtk.CheckButton options.
 */
export function createRadioGroup(props: RadioGroupProps = {}): Gtk.Widget {
  const {
    value = null,
    options = [],
    label = null,
    disabled = false,
    orientation = 'vertical',
    onValueChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  if (label) {
    container.append(new Gtk.Label({ label, xalign: 0 }));
  }

  const radioBox = new Gtk.Box({
    orientation: orientation === 'horizontal'
      ? Gtk.Orientation.HORIZONTAL
      : Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  let groupLeader: Gtk.CheckButton | null = null;

  options.forEach((option) => {
    const radio = new Gtk.CheckButton({
      label: option.label,
      active: option.value === value,
    });

    if (groupLeader) {
      radio.set_group(groupLeader);
    } else {
      groupLeader = radio;
    }

    radio.set_sensitive(!disabled && !option.disabled);
    radio.connect('toggled', () => {
      if (radio.get_active()) {
        onValueChange?.(option.value);
      }
    });

    radioBox.append(radio);
  });

  container.append(radioBox);
  return container;
}
