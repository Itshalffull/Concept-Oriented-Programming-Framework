// ============================================================
// Clef Surface NativeScript Widget — FacetedSearch
//
// Search with faceted filters for narrowing results.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface FacetedSearchProps {
  children?: View[];
  [key: string]: unknown;
}

export function createFacetedSearch(props: FacetedSearchProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-faceted-search';
  container.accessibilityLabel = 'Faceted Search';

  const header = new Label();
  header.text = 'Faceted Search';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createFacetedSearch;
