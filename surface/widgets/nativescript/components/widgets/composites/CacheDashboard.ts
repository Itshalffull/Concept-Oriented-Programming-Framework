// ============================================================
// Clef Surface NativeScript Widget — CacheDashboard
//
// Cache metrics dashboard with hit/miss rates and key browser.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface CacheDashboardProps {
  children?: View[];
  [key: string]: unknown;
}

export function createCacheDashboard(props: CacheDashboardProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-cache-dashboard';
  container.accessibilityLabel = 'Cache Dashboard';

  const header = new Label();
  header.text = 'Cache Dashboard';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createCacheDashboard;
