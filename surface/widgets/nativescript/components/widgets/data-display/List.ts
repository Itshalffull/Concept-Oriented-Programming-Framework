// ============================================================
// Clef Surface NativeScript Widget — List
//
// Scrollable list with selectable items.
// ============================================================

import { StackLayout, Label, ScrollView } from '@nativescript/core';

export interface ListItem { id: string; primary: string; secondary?: string; icon?: string; }

export interface ListProps {
  items: ListItem[];
  selectable?: boolean;
  selectedId?: string;
  emptyMessage?: string;
  onSelect?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createList(props: ListProps): ScrollView {
  const { items, selectable = false, selectedId, emptyMessage = 'No items', onSelect, size = 'md' } = props;
  const scrollView = new ScrollView();
  const container = new StackLayout();
  container.className = `clef-widget-list clef-size-${size}`;
  container.accessibilityRole = 'list';

  if (items.length === 0) {
    const empty = new Label();
    empty.text = emptyMessage;
    empty.horizontalAlignment = 'center';
    empty.opacity = 0.5;
    container.addChild(empty);
  }

  for (const item of items) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '8 12';
    row.className = item.id === selectedId ? 'clef-list-item-selected' : 'clef-list-item';
    row.accessibilityRole = 'listitem';

    if (item.icon) {
      const icon = new Label();
      icon.text = item.icon;
      icon.marginRight = 8;
      row.addChild(icon);
    }

    const textContainer = new StackLayout();
    const primary = new Label();
    primary.text = item.primary;
    textContainer.addChild(primary);
    if (item.secondary) {
      const secondary = new Label();
      secondary.text = item.secondary;
      secondary.opacity = 0.6;
      secondary.fontSize = 12;
      textContainer.addChild(secondary);
    }
    row.addChild(textContainer);

    if (selectable) {
      row.on('tap', () => onSelect?.(item.id));
    }
    container.addChild(row);
  }

  scrollView.content = container;
  return scrollView;
}

export default createList;
