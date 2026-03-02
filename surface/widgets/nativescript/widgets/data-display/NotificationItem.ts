// ============================================================
// Clef Surface NativeScript Widget — NotificationItem
//
// Single notification entry with icon, title, message, timestamp,
// and read/unread state. Renders a tappable NativeScript row
// suitable for embedding in a notification list.
// ============================================================

import { StackLayout, GridLayout, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

// --------------- Props ---------------

export interface NotificationItemProps {
  title?: string;
  message?: string;
  timestamp?: string;
  icon?: string;
  severity?: NotificationSeverity;
  read?: boolean;
  avatarText?: string;
  actionLabel?: string;
  unreadIndicatorColor?: string;
  onTap?: () => void;
  onAction?: () => void;
}

// --------------- Constants ---------------

const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
  info: '#1976D2',
  success: '#388E3C',
  warning: '#F57C00',
  error: '#D32F2F',
};

const SEVERITY_ICONS: Record<NotificationSeverity, string> = {
  info: '\u2139',
  success: '\u2713',
  warning: '\u26A0',
  error: '\u2717',
};

// --------------- Component ---------------

export function createNotificationItem(props: NotificationItemProps = {}): GridLayout {
  const {
    title = 'Notification',
    message,
    timestamp,
    icon,
    severity = 'info',
    read = false,
    avatarText,
    actionLabel,
    unreadIndicatorColor = '#1976D2',
    onTap,
    onAction,
  } = props;

  const container = new GridLayout();
  container.className = `clef-notification-item clef-notification-${severity}`;
  container.columns = 'auto, *, auto';
  container.padding = '12 16';
  container.minHeight = 64;

  if (!read) {
    container.backgroundColor = '#F5F9FF' as any;
  }

  if (onTap) {
    container.on('tap', onTap);
  }

  // --- Left: Icon/Avatar ---
  const leftSection = new StackLayout();
  leftSection.verticalAlignment = 'top';
  leftSection.marginRight = 12;
  leftSection.marginTop = 2;

  const severityColor = SEVERITY_COLORS[severity];

  if (avatarText) {
    const avatar = new GridLayout();
    avatar.width = 40;
    avatar.height = 40;
    avatar.borderRadius = 20;
    avatar.backgroundColor = severityColor as any;

    const avatarLabel = new Label();
    avatarLabel.text = avatarText.slice(0, 2).toUpperCase();
    avatarLabel.color = new Color('#FFFFFF');
    avatarLabel.fontWeight = 'bold';
    avatarLabel.fontSize = 14;
    avatarLabel.horizontalAlignment = 'center';
    avatarLabel.verticalAlignment = 'middle';
    avatar.addChild(avatarLabel);

    leftSection.addChild(avatar);
  } else {
    const iconContainer = new GridLayout();
    iconContainer.width = 36;
    iconContainer.height = 36;
    iconContainer.borderRadius = 18;
    iconContainer.backgroundColor = `${severityColor}20` as any;

    const iconLabel = new Label();
    iconLabel.text = icon || SEVERITY_ICONS[severity];
    iconLabel.fontSize = 16;
    iconLabel.color = new Color(severityColor);
    iconLabel.horizontalAlignment = 'center';
    iconLabel.verticalAlignment = 'middle';
    iconContainer.addChild(iconLabel);

    leftSection.addChild(iconContainer);
  }

  GridLayout.setColumn(leftSection, 0);
  container.addChild(leftSection);

  // --- Center: Content ---
  const content = new StackLayout();
  content.verticalAlignment = 'middle';

  const titleRow = new GridLayout();
  titleRow.columns = '*, auto';

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.className = 'clef-notification-title';
  titleLabel.fontWeight = read ? 'normal' : 'bold';
  titleLabel.fontSize = 14;
  titleLabel.textWrap = true;
  GridLayout.setColumn(titleLabel, 0);
  titleRow.addChild(titleLabel);

  if (!read) {
    const unreadDot = new ContentView();
    unreadDot.width = 8;
    unreadDot.height = 8;
    unreadDot.borderRadius = 4;
    unreadDot.backgroundColor = unreadIndicatorColor as any;
    unreadDot.verticalAlignment = 'middle';
    unreadDot.marginLeft = 8;
    GridLayout.setColumn(unreadDot, 1);
    titleRow.addChild(unreadDot);
  }

  content.addChild(titleRow);

  if (message) {
    const messageLabel = new Label();
    messageLabel.text = message;
    messageLabel.className = 'clef-notification-message';
    messageLabel.fontSize = 13;
    messageLabel.opacity = 0.7;
    messageLabel.textWrap = true;
    messageLabel.marginTop = 2;
    content.addChild(messageLabel);
  }

  if (timestamp) {
    const timestampLabel = new Label();
    timestampLabel.text = timestamp;
    timestampLabel.className = 'clef-notification-timestamp';
    timestampLabel.fontSize = 11;
    timestampLabel.opacity = 0.4;
    timestampLabel.marginTop = 4;
    content.addChild(timestampLabel);
  }

  GridLayout.setColumn(content, 1);
  container.addChild(content);

  // --- Right: Action ---
  if (actionLabel) {
    const actionBtn = new Label();
    actionBtn.text = actionLabel;
    actionBtn.className = 'clef-notification-action';
    actionBtn.fontSize = 12;
    actionBtn.fontWeight = 'bold';
    actionBtn.color = new Color(severityColor);
    actionBtn.verticalAlignment = 'middle';
    actionBtn.marginLeft = 8;
    if (onAction) {
      actionBtn.on('tap', onAction);
    }
    GridLayout.setColumn(actionBtn, 2);
    container.addChild(actionBtn);
  }

  return container;
}

createNotificationItem.displayName = 'NotificationItem';
export default createNotificationItem;
