// ============================================================
// Clef Surface NativeScript Widget — ViewSwitcher
//
// Component for switching between saved view configurations.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface ViewSwitcherProps {
  children?: View[];
  [key: string]: unknown;
}

export function createViewSwitcher(props: ViewSwitcherProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-view-switcher';
  container.accessibilityLabel = 'View Switcher';

  const header = new Label();
  header.text = 'View Switcher';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createViewSwitcher;
