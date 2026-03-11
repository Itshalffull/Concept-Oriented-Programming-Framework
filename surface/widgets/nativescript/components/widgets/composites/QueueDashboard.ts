// ============================================================
// Clef Surface NativeScript Widget — QueueDashboard
//
// Job queue monitoring dashboard.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface QueueDashboardProps {
  children?: View[];
  [key: string]: unknown;
}

export function createQueueDashboard(props: QueueDashboardProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-queue-dashboard';
  container.accessibilityLabel = 'Queue Dashboard';

  const header = new Label();
  header.text = 'Queue Dashboard';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createQueueDashboard;
