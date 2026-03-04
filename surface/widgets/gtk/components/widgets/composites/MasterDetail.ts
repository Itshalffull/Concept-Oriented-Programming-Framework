// ============================================================
// Clef Surface GTK Widget — MasterDetail
//
// Master-detail split layout. Shows a list of items in the
// master pane and detail content for the selected item in the
// detail pane using Gtk.Paned.
//
// Adapts the master-detail.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface MasterItem { id: string; label: string; description?: string; }

// --------------- Props ---------------

export interface MasterDetailProps {
  items?: MasterItem[];
  selectedId?: string | null;
  detailContent?: Gtk.Widget | null;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export function createMasterDetail(props: MasterDetailProps = {}): Gtk.Widget {
  const { items = [], selectedId = null, detailContent = null, onSelect } = props;

  const paned = new Gtk.Paned({ orientation: Gtk.Orientation.HORIZONTAL, position: 250 });

  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.SINGLE });
  listBox.get_style_context().add_class('navigation-sidebar');

  items.forEach((item) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
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

  listBox.connect('row-activated', (_lb: Gtk.ListBox, row: Gtk.ListBoxRow) => {
    onSelect?.((row as any)._itemId);
  });

  const scrolled = new Gtk.ScrolledWindow();
  scrolled.set_child(listBox);
  paned.set_start_child(scrolled);

  const detail = detailContent ?? new Gtk.Label({ label: 'Select an item' });
  paned.set_end_child(detail);

  return paned;
}
