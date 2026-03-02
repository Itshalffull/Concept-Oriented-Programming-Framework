// ============================================================
// Clef Surface Ink Widget — Toast
//
// Ephemeral notification that appears briefly to communicate
// the result of an action, a system event, or a background
// process. Automatically dismisses after a configurable
// duration. Supports info, success, warning, and error
// variants with optional action and close controls.
//
// Terminal adaptation: single-line or bordered notification
// with variant icon. Optional action rendered as [label]
// button text. Escape to dismiss.
// See widget spec: repertoire/widgets/feedback/toast.widget
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Variant Configuration ---------------

const VARIANT_ICONS: Record<string, string> = {
  info: '\u2139',     // ℹ
  success: '\u2714',  // ✔
  warning: '\u26A0',  // ⚠
  error: '\u2716',    // ✖
};

const VARIANT_COLORS: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
};

// --------------- Props ---------------

export interface ToastAction {
  /** Label for the action button. */
  label: string;
  /** Callback fired when the action is activated. */
  onAction: () => void;
}

export interface ToastProps {
  /** Visual variant controlling icon and color. */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Primary notification message. */
  title?: string;
  /** Optional secondary detail text. */
  description?: string;
  /** Auto-dismiss duration in milliseconds. 0 to disable. */
  duration?: number;
  /** Optional action button. */
  action?: ToastAction;
  /** Callback fired when the toast is dismissed. */
  onClose?: () => void;
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const Toast: React.FC<ToastProps> = ({
  variant = 'info',
  title,
  description,
  duration = 5000,
  action,
  onClose,
  isFocused = true,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onClose?.();
  }, [onClose]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration <= 0 || paused || dismissed) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, paused, dismissed, handleDismiss]);

  useInput(
    (input, key) => {
      if (key.escape) {
        handleDismiss();
      } else if (input === 'a' && action) {
        action.onAction();
      }
    },
    { isActive: isFocused && !dismissed },
  );

  if (dismissed) {
    return null;
  }

  const icon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.info;
  const color = VARIANT_COLORS[variant] ?? VARIANT_COLORS.info;

  // Compact single-line mode when there is no description
  if (!description) {
    return (
      <Box paddingX={1}>
        <Text color={color}>{icon} </Text>
        <Text bold>{title}</Text>
        {action && (
          <>
            <Text> </Text>
            <Text color={color} bold>[{action.label}]</Text>
          </>
        )}
      </Box>
    );
  }

  // Bordered multi-line mode
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      paddingY={0}
    >
      <Box>
        <Text color={color}>{icon} </Text>
        <Text bold>{title}</Text>
        <Box flexGrow={1} />
        {action && (
          <Text color={color} bold>[{action.label}]</Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <Text>{description}</Text>
      </Box>
    </Box>
  );
};

Toast.displayName = 'Toast';
export default Toast;
