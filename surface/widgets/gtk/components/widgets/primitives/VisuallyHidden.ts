// ============================================================
// Clef Surface GTK Widget — VisuallyHidden
//
// Screen-reader-only content that is visually hidden but
// remains accessible to assistive technologies. Uses GTK4
// widget with zero visual size but preserved accessibility.
//
// Adapts the visually-hidden.widget spec: anatomy (root),
// states (idle), and connect attributes (aria-hidden)
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface VisuallyHiddenProps {
  text?: string;
  child?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 widget that is visually hidden (zero size)
 * but remains accessible to screen readers via ATK.
 */
export function createVisuallyHidden(props: VisuallyHiddenProps = {}): Gtk.Widget {
  const { text = '', child = null } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    widthRequest: 0,
    heightRequest: 0,
  });

  container.set_opacity(0);
  container.set_overflow(Gtk.Overflow.HIDDEN);

  if (child) {
    container.append(child);
  } else if (text) {
    container.append(new Gtk.Label({ label: text }));
  }

  return container;
}
