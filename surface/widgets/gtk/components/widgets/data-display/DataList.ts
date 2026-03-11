// ============================================================
// Clef Surface GTK Widget — DataList
//
// Key-value data display list. Renders pairs of labels in a
// two-column Gtk.Grid layout with alternating row styling.
//
// Adapts the data-list.widget spec: anatomy (root, item, label,
// value), states (idle, loading), and connect attributes to
// GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface DataListItem {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface DataListProps {
  items?: DataListItem[];
  loading?: boolean;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 key-value data list as a two-column Grid
 * with label and value pairs.
 */
export function createDataList(props: DataListProps = {}): Gtk.Widget {
  const { items = [], loading = false } = props;

  if (loading) {
    return new Gtk.Spinner({ spinning: true });
  }

  const grid = new Gtk.Grid({
    columnSpacing: 16,
    rowSpacing: 8,
  });

  items.forEach((item, row) => {
    const labelWidget = new Gtk.Label({
      label: item.label,
      xalign: 0,
    });
    labelWidget.get_style_context().add_class('dim-label');
    grid.attach(labelWidget, 0, row, 1, 1);

    const valueWidget = new Gtk.Label({
      label: item.value,
      xalign: 0,
      hexpand: true,
      selectable: true,
    });
    grid.attach(valueWidget, 1, row, 1, 1);
  });

  return grid;
}
