// ============================================================
// Clef Surface GTK Widget — Separator
//
// Horizontal or vertical divider line rendered with
// Gtk.Separator. Maps the separator.widget anatomy (root)
// to the native GTK4 separator.
//
// Adapts the separator.widget spec: anatomy (root), states
// (idle), and connect attributes (data-orientation) to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Separator widget as a horizontal or vertical
 * divider line.
 */
export function createSeparator(props: SeparatorProps = {}): Gtk.Widget {
  const { orientation = 'horizontal' } = props;

  const gtkOrientation = orientation === 'vertical'
    ? Gtk.Orientation.VERTICAL
    : Gtk.Orientation.HORIZONTAL;

  return new Gtk.Separator({ orientation: gtkOrientation });
}
