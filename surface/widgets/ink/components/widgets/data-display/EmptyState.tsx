// ============================================================
// Clef Surface Ink Widget — EmptyState
//
// Placeholder display shown when a data view contains no items.
// Provides a friendly visual with an optional icon, title,
// descriptive text, and call-to-action button. Terminal
// adaptation: centered message with icon, title, description,
// and optional action hint.
// See widget spec: repertoire/widgets/data-display/empty-state.widget
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

// --------------- Props ---------------

export interface EmptyStateProps {
  /** Primary message explaining the empty state. */
  title: string;
  /** Optional secondary text with guidance or context. */
  description?: string;
  /** Optional decorative icon or emoji. */
  icon?: string;
  /** Optional call-to-action button. */
  action?: EmptyStateAction;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  isFocused = false,
}) => {
  const handleAction = useCallback(() => {
    action?.onPress();
  }, [action]);

  useInput(
    (input, key) => {
      if (!isFocused || !action) return;
      if (key.return || input === ' ') {
        handleAction();
      }
    },
    { isActive: isFocused && !!action },
  );

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={2}
      paddingX={4}
    >
      {/* Icon */}
      {icon && (
        <Box marginBottom={1}>
          <Text>{icon}</Text>
        </Box>
      )}

      {/* Title */}
      <Text bold>{title}</Text>

      {/* Description */}
      {description && (
        <Box marginTop={1}>
          <Text dimColor>{description}</Text>
        </Box>
      )}

      {/* Action button */}
      {action && (
        <Box marginTop={1}>
          <Text
            color={isFocused ? 'cyan' : 'blue'}
            inverse={isFocused}
          >
            [{action.label}]
          </Text>
        </Box>
      )}
    </Box>
  );
};

EmptyState.displayName = 'EmptyState';
export default EmptyState;
