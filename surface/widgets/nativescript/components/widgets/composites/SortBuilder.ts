// ============================================================
// Clef Surface NativeScript Widget — SortBuilder
//
// Visual sort criteria builder with drag reordering.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface SortBuilderProps {
  children?: View[];
  [key: string]: unknown;
}

export function createSortBuilder(props: SortBuilderProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-sort-builder';
  container.accessibilityLabel = 'Sort Builder';

  const header = new Label();
  header.text = 'Sort Builder';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createSortBuilder;
