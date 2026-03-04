// ============================================================
// Clef Surface NativeScript Widget — NotificationItem
//
// Single notification display with timestamp and actions.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface NotificationAction { id: string; label: string; }

export interface NotificationItemProps {
  title: string;
  description?: string;
  timestamp?: string;
  read?: boolean;
  variant?: 'info' | 'success' | 'warning' | 'error';
  actions?: NotificationAction[];
  onAction?: (id: string) => void;
  onDismiss?: () => void;
}

export function createNotificationItem(props: NotificationItemProps): StackLayout {
  const {
    title, description, timestamp, read = false,
    variant = 'info', actions = [], onAction, onDismiss,
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-notification-item clef-variant-${variant}`;
  container.padding = '12';
  if (!read) container.opacity = 1;
  else container.opacity = 0.6;

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = read ? 'normal' : 'bold';
  container.addChild(titleLabel);

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    desc.fontSize = 13;
    container.addChild(desc);
  }

  if (timestamp) {
    const time = new Label();
    time.text = timestamp;
    time.opacity = 0.5;
    time.fontSize = 11;
    container.addChild(time);
  }

  if (actions.length > 0) {
    const actionsRow = new StackLayout();
    actionsRow.orientation = 'horizontal';
    actionsRow.marginTop = 8;
    for (const action of actions) {
      const btn = new Button();
      btn.text = action.label;
      btn.marginRight = 8;
      btn.on('tap', () => onAction?.(action.id));
      actionsRow.addChild(btn);
    }
    container.addChild(actionsRow);
  }
  return container;
}

export default createNotificationItem;
