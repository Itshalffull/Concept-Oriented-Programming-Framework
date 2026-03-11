// ============================================================
// Clef Surface GTK Widget — RadioCard
//
// Card-style radio selection. Each option is rendered as a
// selectable card with title, description, and radio indicator.
// Uses Gtk.CheckButton in radio mode within styled Gtk.Box cards.
//
// Adapts the radio-card.widget spec: anatomy (root, item, label,
// description, indicator), states (selected, unselected, disabled),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface RadioCardOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface RadioCardProps {
  value?: string | null;
  options?: RadioCardOption[];
  label?: string | null;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 card-style radio selection group with each
 * option rendered as a selectable card.
 */
export function createRadioCard(props: RadioCardProps = {}): Gtk.Widget {
  const {
    value = null,
    options = [],
    label = null,
    disabled = false,
    onValueChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  if (label) {
    container.append(new Gtk.Label({ label, xalign: 0 }));
  }

  let groupLeader: Gtk.CheckButton | null = null;

  options.forEach((option) => {
    const card = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
    });
    card.get_style_context().add_class('card');

    const radio = new Gtk.CheckButton({
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

    card.append(radio);

    const textBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 2,
    });
    textBox.append(new Gtk.Label({ label: option.label, xalign: 0 }));
    if (option.description) {
      const desc = new Gtk.Label({ label: option.description, xalign: 0 });
      desc.get_style_context().add_class('dim-label');
      textBox.append(desc);
    }
    card.append(textBox);

    container.append(card);
  });

  return container;
}
