// ============================================================
// Clef Surface GTK Widget — SlashMenu
//
// Slash-command menu (/) for block editors. Shows a filtered
// list of available block types/commands triggered by slash.
//
// Adapts the slash-menu.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface SlashMenuItem { id: string; label: string; description?: string; iconName?: string; }

// --------------- Props ---------------

export interface SlashMenuProps {
  items?: SlashMenuItem[];
  filter?: string;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export function createSlashMenu(props: SlashMenuProps = {}): Gtk.Widget {
  const { items = [], filter = '', onSelect } = props;

  const filtered = filter
    ? items.filter((i) => i.label.toLowerCase().includes(filter.toLowerCase()))
    : items;

  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.SINGLE });
  listBox.get_style_context().add_class('boxed-list');

  filtered.forEach((item) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    if (item.iconName) row.append(new Gtk.Image({ iconName: item.iconName, pixelSize: 16 }));
    const text = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
    text.append(new Gtk.Label({ label: item.label, xalign: 0 }));
    if (item.description) {
      const desc = new Gtk.Label({ label: item.description, xalign: 0 });
      desc.get_style_context().add_class('dim-label');
      text.append(desc);
    }
    row.append(text);

    const listRow = new Gtk.ListBoxRow();
    listRow.set_child(row);
    (listRow as any)._itemId = item.id;
    listBox.append(listRow);
  });

  listBox.connect('row-activated', (_lb: Gtk.ListBox, row: Gtk.ListBoxRow) => {
    onSelect?.((row as any)._itemId);
  });

  return listBox;
}
