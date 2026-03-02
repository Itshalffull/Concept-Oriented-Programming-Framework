// ============================================================
// Clef Surface Ink Widget — Alert
//
// Inline, persistent status message that communicates important
// information within the terminal layout. Unlike a toast, an
// alert does not auto-dismiss -- it remains visible until the
// user explicitly closes it (when closable) or until the
// triggering condition is resolved.
//
// Terminal adaptation: bordered box with icon prefix
// (info/warning/error/success), variant-colored border.
// Keyboard: Escape to dismiss when closable.
// See widget spec: repertoire/widgets/feedback/alert.widget
// ============================================================

import React, { useState, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Variant Configuration ---------------

const VARIANT_ICONS: Record<string, string> = {
  info: '\u2139',     // ℹ
  warning: '\u26A0',  // ⚠
  error: '\u2716',    // ✖
  success: '\u2714',  // ✔
};

const VARIANT_COLORS: Record<string, string> = {
  info: 'blue',
  warning: 'yellow',
  error: 'red',
  success: 'green',
};

// --------------- Props ---------------

export interface AlertProps {
  /** Visual variant controlling icon, border color, and ARIA role. */
  variant?: 'info' | 'warning' | 'error' | 'success';
  /** Primary alert message. */
  title?: string;
  /** Optional secondary detail or guidance text. */
  description?: string;
  /** Whether the alert can be dismissed by the user. */
  closable?: boolean;
  /** Additional content rendered inside the alert body. */
  children?: ReactNode;
  /** Callback fired when the alert is dismissed. */
  onClose?: () => void;
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
  closable = false,
  children,
  onClose,
  isFocused = true,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    if (!closable) return;
    setDismissed(true);
    onClose?.();
  }, [closable, onClose]);

  useInput(
    (_input, key) => {
      if (key.escape && closable) {
        handleDismiss();
      }
    },
    { isActive: isFocused && closable },
  );

  if (dismissed) {
    return null;
  }

  const icon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.info;
  const color = VARIANT_COLORS[variant] ?? VARIANT_COLORS.info;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      paddingX={1}
      paddingY={0}
    >
      {/* Title row with icon and optional close trigger */}
      <Box>
        <Text color={color}>{icon} </Text>
        {title && <Text bold>{title}</Text>}
        <Box flexGrow={1} />
        {closable && (
          <Text dimColor>[Esc to dismiss]</Text>
        )}
      </Box>

      {/* Description */}
      {description && (
        <Box marginLeft={2}>
          <Text>{description}</Text>
        </Box>
      )}

      {/* Additional children */}
      {children && (
        <Box marginLeft={2} marginTop={description ? 0 : 0}>
          {children}
        </Box>
      )}
    </Box>
  );
};

Alert.displayName = 'Alert';
export default Alert;
