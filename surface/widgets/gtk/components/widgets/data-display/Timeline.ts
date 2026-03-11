// ============================================================
// Clef Surface GTK Widget — Timeline
//
// Chronological event timeline. Renders events as a vertical
// list with timeline connector lines and event markers.
//
// Adapts the timeline.widget spec: anatomy (root, item, marker,
// connector, content, timestamp), states (idle), and connect
// attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
}

// --------------- Props ---------------

export interface TimelineProps {
  events?: TimelineEvent[];
}

// --------------- Component ---------------

/**
 * Creates a GTK4 timeline displaying chronological events with
 * markers and connector lines.
 */
export function createTimeline(props: TimelineProps = {}): Gtk.Widget {
  const { events = [] } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
  });

  events.forEach((event, index) => {
    const row = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
    });

    // Marker column
    const markerCol = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      halign: Gtk.Align.CENTER,
      widthRequest: 20,
    });

    const marker = new Gtk.Label({ label: '\u25CF' }); // Filled circle
    marker.get_style_context().add_class('accent');
    markerCol.append(marker);

    if (index < events.length - 1) {
      const connector = new Gtk.Separator({
        orientation: Gtk.Orientation.VERTICAL,
      });
      connector.set_vexpand(true);
      markerCol.append(connector);
    }

    row.append(markerCol);

    // Content column
    const content = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 2,
      hexpand: true,
    });

    content.append(new Gtk.Label({ label: event.title, xalign: 0 }));

    if (event.description) {
      const desc = new Gtk.Label({ label: event.description, xalign: 0, wrap: true });
      desc.get_style_context().add_class('dim-label');
      content.append(desc);
    }

    if (event.timestamp) {
      const ts = new Gtk.Label({ label: event.timestamp, xalign: 0 });
      ts.get_style_context().add_class('dim-label');
      content.append(ts);
    }

    row.append(content);
    box.append(row);
  });

  return box;
}
