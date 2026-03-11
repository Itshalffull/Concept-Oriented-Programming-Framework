// ============================================================
// Clef Surface NativeScript Widget — NotificationCenter
//
// Notification management panel with filters and actions.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface NotificationCenterProps {
  children?: View[];
  [key: string]: unknown;
}

export function createNotificationCenter(props: NotificationCenterProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-notification-center';
  container.accessibilityLabel = 'Notification Center';

  const header = new Label();
  header.text = 'Notification Center';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createNotificationCenter;
