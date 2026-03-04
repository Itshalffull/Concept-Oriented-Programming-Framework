// ============================================================
// Clef Surface GTK Widget — List
//
// Scrollable list of items. Uses Gtk.ListBox with selectable
// rows for displaying a list of labeled items.
//
// Adapts the list.widget spec: anatomy (root, item, content),
// states (idle, empty), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ListItem {
  id: string;
  label: string;
  description?: string;
}

// --------------- Props ---------------

export interface ListProps {
  items?: ListItem[];
  selectable?: boolean;
  emptyMessage?: string;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 list using Gtk.ListBox with selectable rows
 * for item display.
 */
export function createList(props: ListProps = {}): Gtk.Widget {
  const {
    items = [],
    selectable = true,
    emptyMessage = 'No items',
    onSelect,
  } = props;

  if (items.length === 0) {
    return new Gtk.Label({ label: emptyMessage });
  }

  const listBox = new Gtk.ListBox({
    selectionMode: selectable ? Gtk.SelectionMode.SINGLE : Gtk.SelectionMode.NONE,
  });
  listBox.get_style_context().add_class('boxed-list');

  items.forEach((item) => {
    const row = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 2,
    });
    row.append(new Gtk.Label({ label: item.label, xalign: 0 }));
    if (item.description) {
      const desc = new Gtk.Label({ label: item.description, xalign: 0 });
      desc.get_style_context().add_class('dim-label');
      row.append(desc);
    }

    const listRow = new Gtk.ListBoxRow();
    listRow.set_child(row);
    (listRow as any)._itemId = item.id;
    listBox.append(listRow);
  });

  if (onSelect) {
    listBox.connect('row-activated', (_listBox: Gtk.ListBox, row: Gtk.ListBoxRow) => {
      const id = (row as any)._itemId;
      if (id) onSelect(id);
    });
  }

  return listBox;
}
