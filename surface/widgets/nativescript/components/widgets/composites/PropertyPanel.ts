// ============================================================
// Clef Surface NativeScript Widget — PropertyPanel
//
// Property inspector panel for editing object properties.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface PropertyPanelProps {
  children?: View[];
  [key: string]: unknown;
}

export function createPropertyPanel(props: PropertyPanelProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-property-panel';
  container.accessibilityLabel = 'Property Panel';

  const header = new Label();
  header.text = 'Property Panel';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createPropertyPanel;
