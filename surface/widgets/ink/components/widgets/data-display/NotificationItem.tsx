// ============================================================
// Clef Surface Ink Widget — NotificationItem
//
// Single notification entry displaying a title, optional
// description, timestamp, and read/unread state. Terminal
// adaptation: bullet indicator for read/unread status with
// title, description, and relative timestamp.
// See widget spec: repertoire/widgets/data-display/notification-item.widget
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface NotificationItemProps {
  /** Primary notification text. */
  title: string;
  /** Optional secondary detail text. */
  description?: string;
  /** Timestamp string (relative or absolute). */
  timestamp?: string;
  /** Whether the notification has been read. */
  read?: boolean;
  /** Optional icon or emoji. */
  icon?: string;
  /** Callback when the notification is activated. */
  onPress?: () => void;
  /** Callback when the notification is dismissed. */
  onDismiss?: () => void;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const NotificationItem: React.FC<NotificationItemProps> = ({
  title,
  description,
  timestamp,
  read = false,
  icon,
  onPress,
  onDismiss,
  isFocused = false,
}) => {
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.return || input === ' ') {
        handlePress();
      } else if (key.delete || input === 'd') {
        handleDismiss();
      }
    },
    { isActive: isFocused },
  );

  const indicator = read ? '\u25CB' : '\u25CF'; // ○ or ●
  const indicatorColor = read ? undefined : 'blue';

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle={isFocused ? 'single' : undefined}
      borderColor={isFocused ? 'cyan' : undefined}
    >
      {/* Title row with indicator */}
      <Box>
        <Text color={indicatorColor}>{indicator} </Text>
        {icon && <Text>{icon} </Text>}
        <Text bold={!read}>{title}</Text>
        <Box flexGrow={1} />
        {timestamp && (
          <Text dimColor>{timestamp}</Text>
        )}
      </Box>

      {/* Description */}
      {description && (
        <Box marginLeft={2}>
          <Text dimColor>{description}</Text>
        </Box>
      )}

      {/* Action hints when focused */}
      {isFocused && (onPress || onDismiss) && (
        <Box marginLeft={2} marginTop={0}>
          <Text dimColor>
            {onPress ? '[Enter] open' : ''}
            {onPress && onDismiss ? '  ' : ''}
            {onDismiss ? '[d] dismiss' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
};

NotificationItem.displayName = 'NotificationItem';
export default NotificationItem;
