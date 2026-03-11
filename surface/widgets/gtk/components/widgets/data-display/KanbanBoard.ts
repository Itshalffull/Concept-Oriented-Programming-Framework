// ============================================================
// Clef Surface GTK Widget — KanbanBoard
//
// Column-based kanban board for task/card management. Renders
// columns as vertical Gtk.Box containers in a horizontal
// Gtk.Box layout with cards inside each column.
//
// Adapts the kanban-board.widget spec: anatomy (root, column,
// columnHeader, card, addButton), states (idle, dragging), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

// --------------- Props ---------------

export interface KanbanBoardProps {
  columns?: KanbanColumn[];
  onCardClick?: (cardId: string, columnId: string) => void;
  onAddCard?: (columnId: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 kanban board with horizontal columns containing
 * vertically stacked card items.
 */
export function createKanbanBoard(props: KanbanBoardProps = {}): Gtk.Widget {
  const { columns = [], onCardClick, onAddCard } = props;

  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vscrollbarPolicy: Gtk.PolicyType.NEVER,
  });

  const board = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    homogeneous: true,
  });

  columns.forEach((column) => {
    const colBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 8,
      widthRequest: 250,
    });
    colBox.get_style_context().add_class('background');

    // Column header
    const header = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
    });
    const titleLabel = new Gtk.Label({
      label: `${column.title} (${column.cards.length})`,
      xalign: 0,
      hexpand: true,
    });
    titleLabel.get_style_context().add_class('heading');
    header.append(titleLabel);
    colBox.append(header);

    colBox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));

    // Cards
    const cardList = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });

    column.cards.forEach((card) => {
      const cardWidget = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
      });
      cardWidget.get_style_context().add_class('card');

      cardWidget.append(new Gtk.Label({ label: card.title, xalign: 0 }));
      if (card.description) {
        const desc = new Gtk.Label({ label: card.description, xalign: 0, wrap: true });
        desc.get_style_context().add_class('dim-label');
        cardWidget.append(desc);
      }

      const gesture = new Gtk.GestureClick();
      gesture.connect('released', () => onCardClick?.(card.id, column.id));
      cardWidget.add_controller(gesture);

      cardList.append(cardWidget);
    });

    colBox.append(cardList);

    // Add card button
    const addBtn = new Gtk.Button({ label: '+ Add Card' });
    addBtn.get_style_context().add_class('flat');
    addBtn.connect('clicked', () => onAddCard?.(column.id));
    colBox.append(addBtn);

    board.append(colBox);
  });

  scrolled.set_child(board);
  return scrolled;
}
