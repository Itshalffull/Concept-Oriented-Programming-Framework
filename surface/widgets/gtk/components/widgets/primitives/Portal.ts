// ============================================================
// Clef Surface GTK Widget — Portal
//
// Overlay rendering container. In GTK4 this maps to an
// Gtk.Overlay or a separate Gtk.Window used as a popup layer,
// rendering child content above the main widget tree.
//
// Adapts the portal.widget spec: anatomy (root), states
// (mounted, unmounted), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PortalProps {
  child?: Gtk.Widget | null;
  container?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 portal using Gtk.Overlay to render child
 * content above the main widget tree.
 */
export function createPortal(props: PortalProps = {}): Gtk.Widget {
  const { child = null, container = null } = props;

  const overlay = new Gtk.Overlay();

  if (container) {
    overlay.set_child(container);
  }

  if (child) {
    overlay.add_overlay(child);
  }

  return overlay;
}
