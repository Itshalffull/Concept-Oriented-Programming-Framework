// ============================================================
// Clef Surface GTK Widget — ViewToggle
//
// Toggle between different view modes (e.g., grid, list, table).
// Renders as a row of linked ToggleButton widgets with icons
// representing each view mode.
//
// Adapts the view-toggle.widget spec: anatomy (root, option),
// states (active, inactive), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ViewToggleOption {
  id: string;
  label: string;
  iconName?: string;
}

// --------------- Props ---------------

export interface ViewToggleProps {
  options?: ViewToggleOption[];
  activeId?: string | null;
  onToggle?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 view toggle as a row of linked toggle buttons
 * for switching between view modes.
 */
export function createViewToggle(props: ViewToggleProps = {}): Gtk.Widget {
  const {
    options = [],
    activeId = null,
    onToggle,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
  });
  box.get_style_context().add_class('linked');

  const buttons: Gtk.ToggleButton[] = [];

  options.forEach((option) => {
    const btn = option.iconName
      ? new Gtk.ToggleButton({ iconName: option.iconName, tooltipText: option.label })
      : new Gtk.ToggleButton({ label: option.label });

    btn.set_active(option.id === activeId);

    btn.connect('toggled', () => {
      if (btn.get_active()) {
        buttons.forEach((other) => {
          if (other !== btn && other.get_active()) {
            other.set_active(false);
          }
        });
        onToggle?.(option.id);
      }
    });

    buttons.push(btn);
    box.append(btn);
  });

  return box;
}
