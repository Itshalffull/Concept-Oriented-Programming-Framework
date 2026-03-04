// ============================================================
// Clef Surface GTK Widget — CommandPalette
//
// Quick-action search overlay (Ctrl+K style). Renders as a
// modal dialog with a search entry and filtered list of
// command items. Supports keyboard navigation.
//
// Adapts the command-palette.widget spec: anatomy (root,
// input, list, item, group, empty), states (open, closed,
// filtering), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  group?: string;
}

// --------------- Props ---------------

export interface CommandPaletteProps {
  items?: CommandPaletteItem[];
  placeholder?: string;
  open?: boolean;
  onSelect?: (id: string) => void;
  onClose?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 command palette as a search entry with
 * filtered ListBox of command items.
 */
export function createCommandPalette(props: CommandPaletteProps = {}): Gtk.Widget {
  const {
    items = [],
    placeholder = 'Type a command...',
    onSelect,
    onClose,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  const searchEntry = new Gtk.SearchEntry({
    placeholderText: placeholder,
  });
  container.append(searchEntry);

  const scrolled = new Gtk.ScrolledWindow({
    minContentHeight: 200,
    maxContentHeight: 400,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
  });

  const listBox = new Gtk.ListBox({
    selectionMode: Gtk.SelectionMode.SINGLE,
  });
  listBox.get_style_context().add_class('boxed-list');

  function rebuildList(filter: string): void {
    let child = listBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      listBox.remove(child);
      child = next;
    }

    const filtered = filter
      ? items.filter((item) =>
          item.label.toLowerCase().includes(filter.toLowerCase()) ||
          (item.description?.toLowerCase().includes(filter.toLowerCase()) ?? false)
        )
      : items;

    if (filtered.length === 0) {
      listBox.append(new Gtk.Label({ label: 'No results found', halign: Gtk.Align.CENTER }));
      return;
    }

    filtered.forEach((item) => {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
      row.append(new Gtk.Label({ label: item.label, xalign: 0 }));
      if (item.description) {
        const desc = new Gtk.Label({ label: item.description, xalign: 0 });
        desc.get_style_context().add_class('dim-label');
        row.append(desc);
      }

      const listRow = new Gtk.ListBoxRow();
      listRow.set_child(row);
      (listRow as any)._commandId = item.id;
      listBox.append(listRow);
    });
  }

  rebuildList('');

  searchEntry.connect('search-changed', () => {
    rebuildList(searchEntry.get_text());
  });

  listBox.connect('row-activated', (_listBox: Gtk.ListBox, row: Gtk.ListBoxRow) => {
    const id = (row as any)._commandId;
    if (id) onSelect?.(id);
  });

  // Escape to close
  const keyCtrl = new Gtk.EventControllerKey();
  keyCtrl.connect('key-pressed', (_ctrl: Gtk.EventControllerKey, keyval: number) => {
    if (keyval === 0xff1b) { // Escape
      onClose?.();
      return true;
    }
    return false;
  });
  container.add_controller(keyCtrl);

  scrolled.set_child(listBox);
  container.append(scrolled);

  return container;
}
