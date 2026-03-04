// ============================================================
// Clef Surface NativeScript Widget — CardGrid
//
// Responsive grid layout for card components.
// ============================================================

import { FlexboxLayout, StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface CardGridProps {
  columns?: number;
  gap?: number;
  children?: View[];
}

export function createCardGrid(props: CardGridProps): FlexboxLayout {
  const { columns = 3, gap = 8, children = [] } = props;
  const container = new FlexboxLayout();
  container.className = 'clef-widget-card-grid';
  container.flexWrap = 'wrap';
  for (const child of children) {
    child.margin = String(gap / 2);
    container.addChild(child);
  }
  return container;
}

export default createCardGrid;
