// ============================================================
// Clef Surface GTK Widget — CacheDashboard
//
// Dashboard showing cache entries with key, value preview,
// TTL, and actions (invalidate, refresh). Renders as a
// ListBox of cache entry rows.
//
// Adapts the cache-dashboard.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface CacheEntry {
  key: string;
  value: string;
  ttl?: string;
  size?: string;
}

// --------------- Props ---------------

export interface CacheDashboardProps {
  entries?: CacheEntry[];
  onInvalidate?: (key: string) => void;
  onRefresh?: () => void;
}

// --------------- Component ---------------

export function createCacheDashboard(props: CacheDashboardProps = {}): Gtk.Widget {
  const { entries = [], onInvalidate, onRefresh } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  const title = new Gtk.Label({ label: `Cache (${entries.length} entries)`, xalign: 0, hexpand: true });
  title.get_style_context().add_class('heading');
  header.append(title);

  const refreshBtn = new Gtk.Button({ iconName: 'view-refresh-symbolic', tooltipText: 'Refresh' });
  refreshBtn.get_style_context().add_class('flat');
  if (onRefresh) refreshBtn.connect('clicked', onRefresh);
  header.append(refreshBtn);
  box.append(header);

  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  listBox.get_style_context().add_class('boxed-list');

  entries.forEach((entry) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });

    const infoBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true });
    infoBox.append(new Gtk.Label({ label: entry.key, xalign: 0 }));

    const details: string[] = [];
    if (entry.ttl) details.push(`TTL: ${entry.ttl}`);
    if (entry.size) details.push(`Size: ${entry.size}`);
    if (details.length) {
      const d = new Gtk.Label({ label: details.join(' | '), xalign: 0 });
      d.get_style_context().add_class('dim-label');
      infoBox.append(d);
    }
    row.append(infoBox);

    const invalidateBtn = new Gtk.Button({ iconName: 'edit-delete-symbolic', tooltipText: 'Invalidate' });
    invalidateBtn.get_style_context().add_class('flat');
    invalidateBtn.connect('clicked', () => onInvalidate?.(entry.key));
    row.append(invalidateBtn);

    listBox.append(row);
  });

  box.append(listBox);
  return box;
}
