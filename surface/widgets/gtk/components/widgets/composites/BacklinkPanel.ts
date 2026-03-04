// ============================================================
// Clef Surface GTK Widget — BacklinkPanel
//
// Panel displaying incoming backlinks/references to the current
// document. Renders as a ListBox of link items with title and
// context preview.
//
// Adapts the backlink-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface Backlink {
  id: string;
  title: string;
  context?: string;
}

// --------------- Props ---------------

export interface BacklinkPanelProps {
  backlinks?: Backlink[];
  title?: string;
  onNavigate?: (id: string) => void;
}

// --------------- Component ---------------

export function createBacklinkPanel(props: BacklinkPanelProps = {}): Gtk.Widget {
  const { backlinks = [], title = 'Backlinks', onNavigate } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  const header = new Gtk.Label({ label: `${title} (${backlinks.length})`, xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  if (backlinks.length === 0) {
    const empty = new Gtk.Label({ label: 'No backlinks found' });
    empty.get_style_context().add_class('dim-label');
    box.append(empty);
    return box;
  }

  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  listBox.get_style_context().add_class('boxed-list');

  backlinks.forEach((link) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
    const titleBtn = new Gtk.Button({ label: link.title });
    titleBtn.get_style_context().add_class('flat');
    titleBtn.connect('clicked', () => onNavigate?.(link.id));
    row.append(titleBtn);
    if (link.context) {
      const ctx = new Gtk.Label({ label: link.context, xalign: 0, wrap: true, ellipsize: 3 });
      ctx.get_style_context().add_class('dim-label');
      row.append(ctx);
    }
    listBox.append(row);
  });

  box.append(listBox);
  return box;
}
