// ============================================================
// Clef Surface NativeScript Widget — KanbanBoard
//
// Column-based task board using NativeScript GridLayout with
// horizontal scrolling columns. Each column contains cards
// that represent tasks with title, description, and labels.
// ============================================================

import { StackLayout, GridLayout, ScrollView, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  labels?: KanbanLabel[];
  assignee?: string;
  onTap?: () => void;
}

export interface KanbanLabel {
  text: string;
  color: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  cards: KanbanCard[];
  limit?: number;
}

// --------------- Props ---------------

export interface KanbanBoardProps {
  columns?: KanbanColumn[];
  columnWidth?: number;
  cardSpacing?: number;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  headerHeight?: number;
  showCardCount?: boolean;
  showWipLimit?: boolean;
}

// --------------- Component ---------------

export function createKanbanBoard(props: KanbanBoardProps = {}): ScrollView {
  const {
    columns = [],
    columnWidth = 260,
    cardSpacing = 8,
    backgroundColor = '#ECEFF1',
    cardBackgroundColor = '#FFFFFF',
    headerHeight = 48,
    showCardCount = true,
    showWipLimit = true,
  } = props;

  const scrollView = new ScrollView();
  scrollView.className = 'clef-kanban-board';
  scrollView.orientation = 'horizontal';

  const board = new GridLayout();
  board.className = 'clef-kanban-board-inner';
  board.backgroundColor = backgroundColor as any;
  board.padding = 8;

  if (columns.length === 0) {
    board.columns = '*';
    const emptyLabel = new Label();
    emptyLabel.text = 'No columns defined';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.verticalAlignment = 'middle';
    emptyLabel.marginTop = 32;
    board.addChild(emptyLabel);
    scrollView.content = board;
    return scrollView;
  }

  const colDefs = columns.map(() => `${columnWidth}`).join(', ');
  board.columns = colDefs;

  columns.forEach((column, colIndex) => {
    const colContainer = new StackLayout();
    colContainer.className = 'clef-kanban-column';
    colContainer.margin = 4;
    colContainer.borderRadius = 8;
    colContainer.backgroundColor = '#F5F5F5' as any;

    // --- Column header ---
    const header = new GridLayout();
    header.className = 'clef-kanban-column-header';
    header.columns = 'auto, *, auto';
    header.height = headerHeight;
    header.padding = '8 12';

    const colorBar = new ContentView();
    colorBar.width = 4;
    colorBar.height = 20;
    colorBar.borderRadius = 2;
    colorBar.backgroundColor = (column.color || '#1976D2') as any;
    colorBar.verticalAlignment = 'middle';
    GridLayout.setColumn(colorBar, 0);
    header.addChild(colorBar);

    const titleLabel = new Label();
    titleLabel.text = column.title;
    titleLabel.className = 'clef-kanban-column-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 14;
    titleLabel.verticalAlignment = 'middle';
    titleLabel.marginLeft = 8;
    GridLayout.setColumn(titleLabel, 1);
    header.addChild(titleLabel);

    if (showCardCount) {
      const countText = showWipLimit && column.limit
        ? `${column.cards.length}/${column.limit}`
        : `${column.cards.length}`;

      const countLabel = new Label();
      countLabel.text = countText;
      countLabel.className = 'clef-kanban-column-count';
      countLabel.fontSize = 12;
      countLabel.fontWeight = 'bold';
      countLabel.verticalAlignment = 'middle';
      countLabel.opacity = 0.6;

      if (column.limit && column.cards.length > column.limit) {
        countLabel.color = new Color('#D32F2F');
        countLabel.opacity = 1;
      }

      GridLayout.setColumn(countLabel, 2);
      header.addChild(countLabel);
    }

    colContainer.addChild(header);

    // --- Cards ---
    const cardScroll = new ScrollView();
    cardScroll.className = 'clef-kanban-column-cards';

    const cardStack = new StackLayout();
    cardStack.padding = '4 8 8 8';

    if (column.cards.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No items';
      emptyLabel.opacity = 0.4;
      emptyLabel.horizontalAlignment = 'center';
      emptyLabel.fontSize = 12;
      emptyLabel.marginTop = 16;
      cardStack.addChild(emptyLabel);
    } else {
      column.cards.forEach((card) => {
        const cardView = new StackLayout();
        cardView.className = 'clef-kanban-card';
        cardView.backgroundColor = cardBackgroundColor as any;
        cardView.borderRadius = 6;
        cardView.padding = 10;
        cardView.marginBottom = cardSpacing;
        cardView.androidElevation = 2;

        const cardTitle = new Label();
        cardTitle.text = card.title;
        cardTitle.className = 'clef-kanban-card-title';
        cardTitle.fontWeight = 'bold';
        cardTitle.fontSize = 13;
        cardTitle.textWrap = true;
        cardView.addChild(cardTitle);

        if (card.description) {
          const cardDesc = new Label();
          cardDesc.text = card.description;
          cardDesc.className = 'clef-kanban-card-desc';
          cardDesc.fontSize = 12;
          cardDesc.opacity = 0.7;
          cardDesc.textWrap = true;
          cardDesc.marginTop = 4;
          cardView.addChild(cardDesc);
        }

        // Labels row
        if (card.labels && card.labels.length > 0) {
          const labelsRow = new GridLayout();
          labelsRow.className = 'clef-kanban-card-labels';
          const labelCols = card.labels.map(() => 'auto').join(', ');
          labelsRow.columns = labelCols;
          labelsRow.marginTop = 6;

          card.labels.forEach((lbl, lblIndex) => {
            const badge = new Label();
            badge.text = lbl.text;
            badge.fontSize = 10;
            badge.color = new Color('#FFFFFF');
            badge.backgroundColor = lbl.color as any;
            badge.borderRadius = 4;
            badge.padding = '1 6';
            badge.margin = '0 2';
            GridLayout.setColumn(badge, lblIndex);
            labelsRow.addChild(badge);
          });

          cardView.addChild(labelsRow);
        }

        // Assignee
        if (card.assignee) {
          const assigneeLabel = new Label();
          assigneeLabel.text = card.assignee;
          assigneeLabel.className = 'clef-kanban-card-assignee';
          assigneeLabel.fontSize = 11;
          assigneeLabel.opacity = 0.5;
          assigneeLabel.marginTop = 6;
          assigneeLabel.horizontalAlignment = 'right';
          cardView.addChild(assigneeLabel);
        }

        if (card.onTap) {
          cardView.on('tap', card.onTap);
        }

        cardStack.addChild(cardView);
      });
    }

    cardScroll.content = cardStack;
    colContainer.addChild(cardScroll);

    GridLayout.setColumn(colContainer, colIndex);
    board.addChild(colContainer);
  });

  scrollView.content = board;
  return scrollView;
}

createKanbanBoard.displayName = 'KanbanBoard';
export default createKanbanBoard;
