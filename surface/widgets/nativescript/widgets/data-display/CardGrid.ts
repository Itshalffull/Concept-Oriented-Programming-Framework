// ============================================================
// Clef Surface NativeScript Widget — CardGrid
//
// Responsive grid of cards using NativeScript WrapLayout. Lays
// out Card items in a flowing grid with configurable column
// width, gap, and optional empty state.
// ============================================================

import { StackLayout, WrapLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface CardGridItem {
  title: string;
  subtitle?: string;
  body?: string;
  badge?: string;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface CardGridProps {
  items?: CardGridItem[];
  columnWidth?: number;
  gap?: number;
  padding?: number;
  cardBackgroundColor?: string;
  cardBorderRadius?: number;
  cardElevation?: number;
  emptyMessage?: string;
}

// --------------- Component ---------------

export function createCardGrid(props: CardGridProps = {}): StackLayout {
  const {
    items = [],
    columnWidth = 160,
    gap = 12,
    padding = 8,
    cardBackgroundColor = '#FFFFFF',
    cardBorderRadius = 10,
    cardElevation = 2,
    emptyMessage = 'No items to display',
  } = props;

  const container = new StackLayout();
  container.className = 'clef-card-grid';
  container.padding = padding;

  if (items.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = emptyMessage;
    emptyLabel.className = 'clef-card-grid-empty';
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.verticalAlignment = 'middle';
    emptyLabel.opacity = 0.5;
    emptyLabel.fontSize = 14;
    emptyLabel.marginTop = 32;
    container.addChild(emptyLabel);
    return container;
  }

  const grid = new WrapLayout();
  grid.className = 'clef-card-grid-wrap';
  grid.orientation = 'horizontal';
  grid.itemWidth = columnWidth;
  grid.padding = 0;

  items.forEach((item) => {
    const card = new StackLayout();
    card.className = 'clef-card-grid-item';
    card.width = columnWidth - gap;
    card.margin = gap / 2;
    card.padding = 12;
    card.borderRadius = cardBorderRadius;
    card.backgroundColor = cardBackgroundColor as any;
    card.androidElevation = cardElevation * 2;

    if (item.badge) {
      const badgeLabel = new Label();
      badgeLabel.text = item.badge;
      badgeLabel.className = 'clef-card-grid-badge';
      badgeLabel.fontSize = 10;
      badgeLabel.fontWeight = 'bold';
      badgeLabel.color = new Color('#FFFFFF');
      badgeLabel.backgroundColor = '#1976D2' as any;
      badgeLabel.borderRadius = 8;
      badgeLabel.padding = '2 6';
      badgeLabel.horizontalAlignment = 'left';
      badgeLabel.marginBottom = 6;
      card.addChild(badgeLabel);
    }

    const titleLabel = new Label();
    titleLabel.text = item.title;
    titleLabel.className = 'clef-card-grid-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 14;
    titleLabel.textWrap = true;
    titleLabel.marginBottom = item.subtitle || item.body ? 4 : 0;
    card.addChild(titleLabel);

    if (item.subtitle) {
      const subtitleLabel = new Label();
      subtitleLabel.text = item.subtitle;
      subtitleLabel.className = 'clef-card-grid-subtitle';
      subtitleLabel.fontSize = 12;
      subtitleLabel.opacity = 0.6;
      subtitleLabel.textWrap = true;
      subtitleLabel.marginBottom = item.body ? 4 : 0;
      card.addChild(subtitleLabel);
    }

    if (item.body) {
      const bodyLabel = new Label();
      bodyLabel.text = item.body;
      bodyLabel.className = 'clef-card-grid-body';
      bodyLabel.fontSize = 12;
      bodyLabel.textWrap = true;
      bodyLabel.opacity = 0.8;
      card.addChild(bodyLabel);
    }

    if (item.onTap) {
      card.on('tap', item.onTap);
    }

    grid.addChild(card);
  });

  container.addChild(grid);
  return container;
}

createCardGrid.displayName = 'CardGrid';
export default createCardGrid;
