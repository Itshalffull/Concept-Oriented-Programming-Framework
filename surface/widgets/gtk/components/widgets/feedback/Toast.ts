// ============================================================
// Clef Surface GTK Widget — Toast
//
// Ephemeral notification that appears briefly. Uses Adw.Toast
// for native GNOME toast notifications with variant-based
// priority and optional action button.
//
// Adapts the toast.widget spec: anatomy (root, icon, title,
// description, action, close), states (visible, dismissing),
// and connect attributes to GTK4/Adwaita rendering.
// ============================================================

import Adw from 'gi://Adw?version=1';

// --------------- Types ---------------

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

// --------------- Props ---------------

export interface ToastProps {
  variant?: ToastVariant;
  title?: string;
  description?: string | null;
  timeout?: number;
  action?: ToastAction | null;
  onDismiss?: () => void;
}

// --------------- Component ---------------

/**
 * Creates an Adwaita Toast for ephemeral notification display
 * with variant-based priority and optional action button.
 */
export function createToast(props: ToastProps = {}): Adw.Toast {
  const {
    title = '',
    timeout = 3,
    action = null,
    onDismiss,
  } = props;

  const toast = new Adw.Toast({
    title,
    timeout,
  });

  if (action) {
    toast.set_button_label(action.label);
    toast.connect('button-clicked', action.onAction);
  }

  if (onDismiss) {
    toast.connect('dismissed', onDismiss);
  }

  return toast;
}
