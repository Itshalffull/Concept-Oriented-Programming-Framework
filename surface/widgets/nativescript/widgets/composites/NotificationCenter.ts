// ============================================================
// Clef Surface NativeScript Widget — NotificationCenter
//
// Notification list with category filtering and read/unread
// state. Displays notifications grouped by severity with
// timestamp, message, and dismiss/mark-read actions.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Button, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  timestamp: string;
  read?: boolean;
}

// --------------- Props ---------------

export interface NotificationCenterProps {
  /** List of notifications. */
  notifications?: Notification[];
  /** Currently active category filter (null = all). */
  activeFilter?: NotificationLevel | null;
  /** Called when a notification is dismissed. */
  onDismiss?: (id: string) => void;
  /** Called when a notification is marked read. */
  onMarkRead?: (id: string) => void;
  /** Called when all are marked read. */
  onMarkAllRead?: () => void;
  /** Called when category filter changes. */
  onFilterChange?: (level: NotificationLevel | null) => void;
}

// --------------- Helpers ---------------

const LEVEL_COLORS: Record<NotificationLevel, string> = {
  info: '#2196F3',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
};

const LEVEL_ICONS: Record<NotificationLevel, string> = {
  info: '\u2139',
  success: '\u2713',
  warning: '\u26A0',
  error: '\u2718',
};

// --------------- Component ---------------

export function createNotificationCenter(props: NotificationCenterProps = {}): StackLayout {
  const {
    notifications = [],
    activeFilter = null,
    onDismiss,
    onMarkRead,
    onMarkAllRead,
    onFilterChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-notification-center';
  container.padding = 12;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto, auto';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = 'Notifications';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  const unreadCount = notifications.filter((n) => !n.read).length;
  if (unreadCount > 0) {
    const badgeLabel = new Label();
    badgeLabel.text = `${unreadCount} unread`;
    badgeLabel.fontSize = 11;
    badgeLabel.opacity = 0.6;
    badgeLabel.verticalAlignment = 'middle';
    badgeLabel.marginRight = 8;
    GridLayout.setColumn(badgeLabel, 1);
    header.addChild(badgeLabel);
  }

  if (onMarkAllRead && unreadCount > 0) {
    const markAllBtn = new Button();
    markAllBtn.text = 'Mark All Read';
    markAllBtn.fontSize = 11;
    markAllBtn.padding = 4;
    GridLayout.setColumn(markAllBtn, 2);
    markAllBtn.on('tap', () => onMarkAllRead());
    header.addChild(markAllBtn);
  }

  container.addChild(header);

  // Category filter tabs
  const filterRow = new StackLayout();
  filterRow.orientation = 'horizontal' as any;
  filterRow.marginBottom = 8;

  const categories: Array<{ label: string; value: NotificationLevel | null }> = [
    { label: 'All', value: null },
    { label: 'Info', value: 'info' },
    { label: 'Success', value: 'success' },
    { label: 'Warning', value: 'warning' },
    { label: 'Error', value: 'error' },
  ];

  categories.forEach((cat) => {
    const btn = new Button();
    btn.text = cat.label;
    btn.fontSize = 11;
    btn.padding = 4;
    btn.marginRight = 4;
    if (activeFilter === cat.value) {
      btn.fontWeight = 'bold';
    }
    if (onFilterChange) {
      btn.on('tap', () => onFilterChange(cat.value));
    }
    filterRow.addChild(btn);
  });

  container.addChild(filterRow);

  // Filtered notifications
  const filtered = activeFilter
    ? notifications.filter((n) => n.level === activeFilter)
    : notifications;

  if (filtered.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No notifications.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  // Notification list
  const scrollView = new ScrollView();
  const list = new StackLayout();

  filtered.forEach((notif) => {
    const row = new GridLayout();
    row.columns = 'auto, *, auto';
    row.padding = 8;
    row.marginBottom = 4;
    row.borderRadius = 4;
    row.borderLeftWidth = 3;
    row.borderColor = LEVEL_COLORS[notif.level];
    row.backgroundColor = notif.read ? ('#FAFAFA' as any) : ('#FFF8E1' as any);

    // Level icon
    const iconLabel = new Label();
    iconLabel.text = LEVEL_ICONS[notif.level];
    iconLabel.color = LEVEL_COLORS[notif.level] as any;
    iconLabel.fontSize = 14;
    iconLabel.verticalAlignment = 'top';
    iconLabel.marginRight = 8;
    GridLayout.setColumn(iconLabel, 0);
    row.addChild(iconLabel);

    // Content
    const contentStack = new StackLayout();
    GridLayout.setColumn(contentStack, 1);

    const notifTitle = new Label();
    notifTitle.text = notif.title;
    notifTitle.fontWeight = notif.read ? 'normal' : 'bold';
    notifTitle.fontSize = 13;
    contentStack.addChild(notifTitle);

    const msgLabel = new Label();
    msgLabel.text = notif.message;
    msgLabel.textWrap = true;
    msgLabel.opacity = 0.7;
    msgLabel.fontSize = 12;
    msgLabel.marginTop = 2;
    contentStack.addChild(msgLabel);

    const timeLabel = new Label();
    timeLabel.text = notif.timestamp;
    timeLabel.opacity = 0.4;
    timeLabel.fontSize = 10;
    timeLabel.marginTop = 4;
    contentStack.addChild(timeLabel);

    row.addChild(contentStack);

    // Actions
    const actionsStack = new StackLayout();
    actionsStack.verticalAlignment = 'top';
    GridLayout.setColumn(actionsStack, 2);

    if (!notif.read && onMarkRead) {
      const readBtn = new Button();
      readBtn.text = 'Read';
      readBtn.fontSize = 10;
      readBtn.padding = 2;
      readBtn.marginBottom = 2;
      readBtn.on('tap', () => onMarkRead(notif.id));
      actionsStack.addChild(readBtn);
    }

    if (onDismiss) {
      const dismissBtn = new Button();
      dismissBtn.text = '\u2715';
      dismissBtn.fontSize = 10;
      dismissBtn.padding = 2;
      dismissBtn.on('tap', () => onDismiss(notif.id));
      actionsStack.addChild(dismissBtn);
    }

    row.addChild(actionsStack);
    list.addChild(row);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createNotificationCenter.displayName = 'NotificationCenter';
export default createNotificationCenter;
