// ============================================================
// Clef Surface GTK Widget — ToggleSwitch
//
// Binary on/off toggle control. Renders a Gtk.Switch with an
// optional label. Maps the toggle-switch.widget anatomy (root,
// input, control, thumb, label) to Gtk.Switch with label.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface ToggleSwitchProps {
  checked?: boolean;
  label?: string | null;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Switch widget for binary on/off toggling with
 * an optional label.
 */
export function createToggleSwitch(props: ToggleSwitchProps = {}): Gtk.Widget {
  const {
    checked = false,
    label = null,
    disabled = false,
    onCheckedChange,
  } = props;

  const gtkSwitch = new Gtk.Switch({
    active: checked,
  });

  gtkSwitch.set_sensitive(!disabled);

  if (onCheckedChange) {
    gtkSwitch.connect('notify::active', () => {
      onCheckedChange(gtkSwitch.get_active());
    });
  }

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
    });
    box.append(gtkSwitch);
    box.append(new Gtk.Label({ label }));
    return box;
  }

  return gtkSwitch;
}
