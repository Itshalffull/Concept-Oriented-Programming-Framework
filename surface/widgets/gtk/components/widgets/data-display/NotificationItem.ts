// ============================================================
// Clef Surface GTK Widget — NotificationItem
//
// Individual notification display with icon, title, message,
// timestamp, and read/unread indicator. Renders as an
// Adw.ActionRow-style widget.
//
// Adapts the notification-item.widget spec: anatomy (root,
// icon, title, message, timestamp, readIndicator), states
// (read, unread), and connect attributes to GTK4/Adwaita
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Props ---------------

export interface NotificationItemProps {
  title?: string;
  message?: string;
  timestamp?: string;
  read?: boolean;
  iconName?: string;
  onClick?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4/Adwaita notification item as an ActionRow
 * with icon, title, message, and read indicator.
 */
export function createNotificationItem(props: NotificationItemProps = {}): Gtk.Widget {
  const {
    title = '',
    message = '',
    timestamp = '',
    read = false,
    iconName = 'mail-unread-symbolic',
    onClick,
  } = props;

  const row = new Adw.ActionRow({
    title,
    subtitle: message,
  });

  // Leading icon
  const icon = new Gtk.Image({
    iconName: read ? 'mail-read-symbolic' : iconName,
    pixelSize: 24,
  });
  row.add_prefix(icon);

  // Unread indicator
  if (!read) {
    const dot = new Gtk.Label({ label: '\u2022' });
    dot.get_style_context().add_class('accent');
    row.add_prefix(dot);
  }

  // Timestamp suffix
  if (timestamp) {
    const ts = new Gtk.Label({ label: timestamp });
    ts.get_style_context().add_class('dim-label');
    row.add_suffix(ts);
  }

  row.set_activatable(true);
  if (onClick) {
    row.connect('activated', onClick);
  }

  return row;
}
