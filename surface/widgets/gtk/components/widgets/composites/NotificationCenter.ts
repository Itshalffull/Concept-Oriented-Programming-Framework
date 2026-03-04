// ============================================================
// Clef Surface GTK Widget — NotificationCenter
//
// Aggregated notification feed with filtering and mark-all-read.
// Renders as a ListBox of notification items with action buttons.
//
// Adapts the notification-center.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export interface Notification { id: string; title: string; message?: string; type?: NotificationType; read?: boolean; timestamp?: string; }

// --------------- Props ---------------

export interface NotificationCenterProps {
  notifications?: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onDismiss?: (id: string) => void;
}

// --------------- Component ---------------

export function createNotificationCenter(props: NotificationCenterProps = {}): Gtk.Widget {
  const { notifications = [], onMarkRead, onMarkAllRead, onDismiss } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  const unread = notifications.filter((n) => !n.read).length;
  header.append(new Gtk.Label({ label: `Notifications (${unread} unread)`, xalign: 0, hexpand: true }));
  const markAllBtn = new Gtk.Button({ label: 'Mark all read' });
  markAllBtn.get_style_context().add_class('flat');
  if (onMarkAllRead) markAllBtn.connect('clicked', onMarkAllRead);
  header.append(markAllBtn);
  box.append(header);

  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  listBox.get_style_context().add_class('boxed-list');

  notifications.forEach((notif) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    const iconName = notif.read ? 'mail-read-symbolic' : 'mail-unread-symbolic';
    row.append(new Gtk.Image({ iconName, pixelSize: 16 }));

    const text = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true });
    text.append(new Gtk.Label({ label: notif.title, xalign: 0 }));
    if (notif.message) {
      const msg = new Gtk.Label({ label: notif.message, xalign: 0, wrap: true });
      msg.get_style_context().add_class('dim-label');
      text.append(msg);
    }
    row.append(text);

    if (!notif.read) {
      const readBtn = new Gtk.Button({ iconName: 'object-select-symbolic', tooltipText: 'Mark read' });
      readBtn.get_style_context().add_class('flat');
      readBtn.connect('clicked', () => onMarkRead?.(notif.id));
      row.append(readBtn);
    }

    const dismissBtn = new Gtk.Button({ iconName: 'window-close-symbolic', tooltipText: 'Dismiss' });
    dismissBtn.get_style_context().add_class('flat');
    dismissBtn.connect('clicked', () => onDismiss?.(notif.id));
    row.append(dismissBtn);

    listBox.append(row);
  });

  box.append(listBox);
  return box;
}
