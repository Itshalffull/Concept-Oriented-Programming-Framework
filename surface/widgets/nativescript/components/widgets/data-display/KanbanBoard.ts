// ============================================================
// Clef Surface NativeScript Widget — KanbanBoard
//
// Kanban board with draggable cards across columns.
// ============================================================

import { StackLayout, ScrollView, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface KanbanItem { id: string; title: string; description?: string; }
export interface KanbanColumn { id: string; title: string; items: KanbanItem[]; }

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  onMoveItem?: (itemId: string, fromColumn: string, toColumn: string) => void;
  onItemClick?: (itemId: string) => void;
  ariaLabel?: string;
}

export function createKanbanBoard(props: KanbanBoardProps): ScrollView {
  const { columns, onMoveItem, onItemClick, ariaLabel = 'Kanban board' } = props;
  const scrollView = new ScrollView();
  scrollView.orientation = 'horizontal';

  const board = new StackLayout();
  board.className = 'clef-widget-kanban-board';
  board.orientation = 'horizontal';
  board.accessibilityLabel = ariaLabel;

  for (const column of columns) {
    const col = new StackLayout();
    col.className = 'clef-kanban-column';
    col.width = 280;
    col.padding = '8';

    const colHeader = new Label();
    colHeader.text = `${column.title} (${column.items.length})`;
    colHeader.fontWeight = 'bold';
    colHeader.marginBottom = 8;
    col.addChild(colHeader);

    for (const item of column.items) {
      const card = new StackLayout();
      card.className = 'clef-kanban-card';
      card.padding = '8';
      card.marginBottom = 4;

      const title = new Label();
      title.text = item.title;
      title.fontWeight = 'bold';
      card.addChild(title);

      if (item.description) {
        const desc = new Label();
        desc.text = item.description;
        desc.textWrap = true;
        desc.opacity = 0.7;
        desc.fontSize = 12;
        card.addChild(desc);
      }

      card.on('tap', () => onItemClick?.(item.id));
      col.addChild(card);
    }
    board.addChild(col);
  }

  scrollView.content = board;
  return scrollView;
}

export default createKanbanBoard;
