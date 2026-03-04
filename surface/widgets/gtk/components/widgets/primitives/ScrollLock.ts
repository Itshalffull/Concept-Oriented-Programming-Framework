// ============================================================
// Clef Surface GTK Widget — ScrollLock
//
// Scroll interception wrapper that prevents scrolling of the
// content beneath when active. Uses Gtk.ScrolledWindow with
// policy controls to lock/unlock scrolling.
//
// Adapts the scroll-lock.widget spec: anatomy (root), states
// (locked, unlocked), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface ScrollLockProps {
  locked?: boolean;
  child?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 ScrolledWindow that locks/unlocks scrolling
 * based on the locked state.
 */
export function createScrollLock(props: ScrollLockProps = {}): Gtk.Widget {
  const { locked = false, child = null } = props;

  const scrolled = new Gtk.ScrolledWindow();

  if (locked) {
    scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
  } else {
    scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
  }

  if (child) {
    scrolled.set_child(child);
  }

  return scrolled;
}
