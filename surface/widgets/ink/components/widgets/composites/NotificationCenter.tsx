// ============================================================
// Clef Surface Ink Widget — NotificationCenter
//
// Notification feed panel with an unread count badge, list of
// notification items with read/unread state, type indicators,
// and timestamps. Supports mark-as-read, dismiss, and clear
// actions. Terminal rendering with bordered panel and keyboard
// navigation. Maps notification-center.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Notification {
  id: string;
  title: string;
  description?: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
}

// --------------- Props ---------------

export interface NotificationCenterProps {
  /** Array of notifications. */
  notifications: Notification[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a notification is marked as read. */
  onRead?: (id: string) => void;
  /** Callback when a notification is dismissed. */
  onDismiss?: (id: string) => void;
  /** Callback to clear all notifications. */
  onClear?: () => void;
}

// --------------- Helpers ---------------

const TYPE_ICON: Record<string, string> = {
  info: '\u2139',
  warning: '\u26A0',
  error: '\u2716',
  success: '\u2714',
};

const TYPE_COLOR: Record<string, string> = {
  info: 'blue',
  warning: 'yellow',
  error: 'red',
  success: 'green',
};

// --------------- Component ---------------

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  isFocused = false,
  onRead,
  onDismiss,
  onClear,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  // Items: notification rows + clear all button
  const totalItems = notifications.length + 1;

  const unreadCount = notifications.filter((n) => !n.read).length;

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (focusIndex < notifications.length) {
          const notif = notifications[focusIndex];
          if (notif && !notif.read) {
            onRead?.(notif.id);
          }
        } else {
          onClear?.();
        }
      } else if (input === 'd' || key.delete) {
        if (focusIndex < notifications.length) {
          const notif = notifications[focusIndex];
          if (notif) onDismiss?.(notif.id);
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Notifications</Text>
        {unreadCount > 0 && (
          <Text color="red" bold> ({unreadCount} unread)</Text>
        )}
      </Box>

      {/* Notification List */}
      {notifications.map((notif, index) => {
        const focused = isFocused && index === focusIndex;
        const icon = TYPE_ICON[notif.type] || '\u2022';
        const color = TYPE_COLOR[notif.type] || undefined;

        return (
          <Box key={notif.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={focused ? 'cyan' : (color as any)}>
                {icon}{' '}
              </Text>
              <Text
                bold={focused || !notif.read}
                color={focused ? 'cyan' : undefined}
                dimColor={notif.read && !focused}
              >
                {notif.title}
              </Text>
              <Text dimColor> {notif.time}</Text>
              {!notif.read && <Text color="red"> {'\u25CF'}</Text>}
            </Box>
            {notif.description && (
              <Box marginLeft={2}>
                <Text dimColor wrap="truncate-end">{notif.description}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {notifications.length === 0 && (
        <Text dimColor>No notifications.</Text>
      )}

      {/* Clear All Button */}
      <Box marginTop={1}>
        <Text
          bold={isFocused && focusIndex === notifications.length}
          inverse={isFocused && focusIndex === notifications.length}
          color={isFocused && focusIndex === notifications.length ? 'red' : 'gray'}
        >
          [ Clear All ]
        </Text>
      </Box>
    </Box>
  );
};

NotificationCenter.displayName = 'NotificationCenter';
export default NotificationCenter;
