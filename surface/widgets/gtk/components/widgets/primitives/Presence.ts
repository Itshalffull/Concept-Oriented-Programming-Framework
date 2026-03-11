// ============================================================
// Clef Surface GTK Widget — Presence
//
// Conditional rendering wrapper with animated enter/exit
// transitions. Uses Gtk.Revealer for expand/collapse
// animations when the child mounts or unmounts.
//
// Adapts the presence.widget spec: anatomy (root), states
// (present, hidden), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PresenceProps {
  present?: boolean;
  child?: Gtk.Widget | null;
  transitionType?: Gtk.RevealerTransitionType;
  transitionDuration?: number;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Revealer for conditional rendering with
 * animated enter/exit transitions.
 */
export function createPresence(props: PresenceProps = {}): Gtk.Widget {
  const {
    present = true,
    child = null,
    transitionType = Gtk.RevealerTransitionType.CROSSFADE,
    transitionDuration = 200,
  } = props;

  const revealer = new Gtk.Revealer({
    revealChild: present,
    transitionType,
    transitionDuration,
  });

  if (child) {
    revealer.set_child(child);
  }

  return revealer;
}
