// ============================================================
// Clef Surface GTK Widget — QueueDashboard
//
// Dashboard for monitoring message/job queues. Shows queue
// metrics with depth, processing rate, and error counts.
//
// Adapts the queue-dashboard.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface Queue { id: string; name: string; depth: number; processing: number; errors: number; }

// --------------- Props ---------------

export interface QueueDashboardProps {
  queues?: Queue[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onPurge?: (id: string) => void;
}

// --------------- Component ---------------

export function createQueueDashboard(props: QueueDashboardProps = {}): Gtk.Widget {
  const { queues = [], onPause, onResume, onPurge } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: `Queues (${queues.length})`, xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  listBox.get_style_context().add_class('boxed-list');

  queues.forEach((queue) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
    const info = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true });
    info.append(new Gtk.Label({ label: queue.name, xalign: 0 }));
    const stats = new Gtk.Label({ label: `Depth: ${queue.depth} | Processing: ${queue.processing} | Errors: ${queue.errors}`, xalign: 0 });
    stats.get_style_context().add_class('dim-label');
    info.append(stats);
    row.append(info);

    const pauseBtn = new Gtk.Button({ iconName: 'media-playback-pause-symbolic', tooltipText: 'Pause' });
    pauseBtn.get_style_context().add_class('flat');
    pauseBtn.connect('clicked', () => onPause?.(queue.id));
    row.append(pauseBtn);

    const resumeBtn = new Gtk.Button({ iconName: 'media-playback-start-symbolic', tooltipText: 'Resume' });
    resumeBtn.get_style_context().add_class('flat');
    resumeBtn.connect('clicked', () => onResume?.(queue.id));
    row.append(resumeBtn);

    const purgeBtn = new Gtk.Button({ iconName: 'edit-delete-symbolic', tooltipText: 'Purge' });
    purgeBtn.get_style_context().add_class('destructive-action');
    purgeBtn.connect('clicked', () => onPurge?.(queue.id));
    row.append(purgeBtn);

    listBox.append(row);
  });

  box.append(listBox);
  return box;
}
