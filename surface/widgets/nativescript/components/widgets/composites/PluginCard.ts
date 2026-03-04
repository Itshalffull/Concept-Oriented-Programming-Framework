// ============================================================
// Clef Surface NativeScript Widget — PluginCard
//
// Plugin/extension card with lifecycle state management.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface PluginCardProps {
  children?: View[];
  [key: string]: unknown;
}

export function createPluginCard(props: PluginCardProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-plugin-card';
  container.accessibilityLabel = 'Plugin Card';

  const header = new Label();
  header.text = 'Plugin Card';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createPluginCard;
