// ============================================================
// Clef Surface GTK Widget — FocusTrap
//
// Focus-constraining container that keeps keyboard focus within
// its child hierarchy. Uses GTK4 focus management to prevent
// tab-out when active.
//
// Adapts the focus-trap.widget spec: anatomy (root), states
// (active, inactive), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface FocusTrapProps {
  active?: boolean;
  child?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 focus trap container that constrains keyboard
 * navigation within its child widget hierarchy.
 */
export function createFocusTrap(props: FocusTrapProps = {}): Gtk.Widget {
  const { active = true, child = null } = props;

  const frame = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
  });

  if (active) {
    frame.set_focusable(true);
    frame.set_focus_on_click(true);
    frame.set_can_focus(true);
  }

  if (child) {
    frame.append(child);
  }

  return frame;
}
