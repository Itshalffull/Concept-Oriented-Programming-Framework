// ============================================================
// Clef Surface GTK Widget — ViewSwitcher
//
// Multi-view layout switcher with named view definitions.
// Uses Adw.ViewSwitcher or linked toggle buttons for switching
// between different content views.
//
// Adapts the view-switcher.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ViewDef { id: string; label: string; iconName?: string; }

// --------------- Props ---------------

export interface ViewSwitcherProps {
  views?: ViewDef[];
  activeId?: string | null;
  onSwitch?: (id: string) => void;
}

// --------------- Component ---------------

export function createViewSwitcher(props: ViewSwitcherProps = {}): Gtk.Widget {
  const { views = [], activeId = null, onSwitch } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });
  box.get_style_context().add_class('linked');

  const buttons: Gtk.ToggleButton[] = [];

  views.forEach((view) => {
    const btn = view.iconName
      ? new Gtk.ToggleButton({ iconName: view.iconName, tooltipText: view.label })
      : new Gtk.ToggleButton({ label: view.label });

    btn.set_active(view.id === activeId);
    btn.connect('toggled', () => {
      if (btn.get_active()) {
        buttons.forEach((other) => { if (other !== btn && other.get_active()) other.set_active(false); });
        onSwitch?.(view.id);
      }
    });
    buttons.push(btn);
    box.append(btn);
  });

  return box;
}
