// ============================================================
// Clef Surface NativeScript Widget — FilterBuilder
//
// Visual query builder for composing filter conditions.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface FilterBuilderProps {
  children?: View[];
  [key: string]: unknown;
}

export function createFilterBuilder(props: FilterBuilderProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-filter-builder';
  container.accessibilityLabel = 'Filter Builder';

  const header = new Label();
  header.text = 'Filter Builder';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createFilterBuilder;
