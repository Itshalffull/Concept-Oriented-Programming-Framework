// ============================================================
// Clef Surface GTK Widget — ToastManager
//
// Container that manages a queue of toast notifications.
// Uses Adw.ToastOverlay as the root widget that can display
// toasts added via its add_toast method.
//
// Adapts the toast-manager.widget spec: anatomy (root, toastList),
// states (idle, showing), and connect attributes to GTK4/Adwaita
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Props ---------------

export interface ToastManagerProps {
  child?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates an Adwaita ToastOverlay that manages toast notification
 * display and queuing over the child content.
 */
export function createToastManager(props: ToastManagerProps = {}): Adw.ToastOverlay {
  const { child = null } = props;

  const overlay = new Adw.ToastOverlay();

  if (child) {
    overlay.set_child(child);
  }

  return overlay;
}
