// ============================================================
// Clef Surface GTK Widget — Alert
//
// Inline notification banner with variant-based styling.
// Renders as an Adw.Banner or styled Gtk.Box with icon, title,
// description, and optional close button.
//
// Adapts the alert.widget spec: anatomy (root, icon, title,
// description, close), states (info, success, warning, error),
// and connect attributes to GTK4/Adwaita rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  description?: string | null;
  closable?: boolean;
  onClose?: () => void;
}

// --------------- Helpers ---------------

function iconForVariant(variant: string): string {
  switch (variant) {
    case 'success': return 'emblem-ok-symbolic';
    case 'warning': return 'dialog-warning-symbolic';
    case 'error': return 'dialog-error-symbolic';
    default: return 'dialog-information-symbolic';
  }
}

// --------------- Component ---------------

/**
 * Creates a GTK4 alert banner with variant-based icon and styling,
 * optional description, and close button.
 */
export function createAlert(props: AlertProps = {}): Gtk.Widget {
  const {
    variant = 'info',
    title = '',
    description = null,
    closable = false,
    onClose,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
  });
  const ctx = box.get_style_context();
  ctx.add_class('alert');
  ctx.add_class(`alert-${variant}`);

  // Icon
  box.append(new Gtk.Image({ iconName: iconForVariant(variant), pixelSize: 24 }));

  // Text content
  const textBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    hexpand: true,
  });
  textBox.append(new Gtk.Label({ label: title, xalign: 0 }));
  if (description) {
    const desc = new Gtk.Label({ label: description, xalign: 0, wrap: true });
    desc.get_style_context().add_class('dim-label');
    textBox.append(desc);
  }
  box.append(textBox);

  // Close button
  if (closable) {
    const closeBtn = new Gtk.Button({ iconName: 'window-close-symbolic' });
    closeBtn.get_style_context().add_class('flat');
    if (onClose) {
      closeBtn.connect('clicked', onClose);
    }
    box.append(closeBtn);
  }

  return box;
}
