// ============================================================
// Clef Surface GTK Widget — CardGrid
//
// Responsive grid of Card widgets. Uses Gtk.FlowBox for
// automatic wrapping of card children based on available width.
//
// Adapts the card-grid.widget spec: anatomy (root, card), states
// (idle, loading), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface CardGridItem {
  title: string;
  subtitle?: string;
  content?: string;
}

// --------------- Props ---------------

export interface CardGridProps {
  items?: CardGridItem[];
  columns?: number;
  loading?: boolean;
  emptyMessage?: string;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 responsive card grid using Gtk.FlowBox for
 * automatic card layout and wrapping.
 */
export function createCardGrid(props: CardGridProps = {}): Gtk.Widget {
  const {
    items = [],
    columns = 3,
    loading = false,
    emptyMessage = 'No items',
  } = props;

  if (loading) {
    const spinner = new Gtk.Spinner({ spinning: true });
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER });
    box.append(spinner);
    box.append(new Gtk.Label({ label: 'Loading...' }));
    return box;
  }

  if (items.length === 0) {
    return new Gtk.Label({ label: emptyMessage });
  }

  const flowBox = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    maxChildrenPerLine: columns,
    minChildrenPerLine: 1,
    homogeneous: true,
  });

  items.forEach((item) => {
    const card = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });
    card.get_style_context().add_class('card');

    const titleLabel = new Gtk.Label({ label: item.title, xalign: 0 });
    titleLabel.get_style_context().add_class('title-4');
    card.append(titleLabel);

    if (item.subtitle) {
      const sub = new Gtk.Label({ label: item.subtitle, xalign: 0 });
      sub.get_style_context().add_class('dim-label');
      card.append(sub);
    }

    if (item.content) {
      card.append(new Gtk.Label({ label: item.content, xalign: 0, wrap: true }));
    }

    flowBox.insert(card, -1);
  });

  return flowBox;
}
