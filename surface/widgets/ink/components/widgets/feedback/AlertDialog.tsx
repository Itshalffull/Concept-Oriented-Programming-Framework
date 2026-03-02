// ============================================================
// Clef Surface Ink Widget — AlertDialog
//
// Confirmation dialog that requires an explicit user action
// before it can be dismissed. Unlike a standard dialog,
// pressing Escape does NOT close it -- the user must interact
// with a confirm or cancel action. Used for destructive
// operations, unsaved-changes guards, and critical confirmations.
//
// Terminal adaptation: bordered dialog box with two action
// buttons. Tab to switch focus between Cancel and Confirm,
// Enter to activate the focused action.
// See widget spec: repertoire/widgets/feedback/alert-dialog.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface AlertDialogProps {
  /** Whether the alert dialog is open. */
  open?: boolean;
  /** Heading that labels the alert dialog. */
  title?: string;
  /** Text explaining the action and its consequences. */
  description?: string;
  /** Label for the cancel action. */
  cancelLabel?: string;
  /** Label for the confirm action. */
  confirmLabel?: string;
  /** Callback fired when the user cancels. */
  onCancel?: () => void;
  /** Callback fired when the user confirms. */
  onConfirm?: () => void;
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const AlertDialog: React.FC<AlertDialogProps> = ({
  open = false,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
  isFocused = true,
}) => {
  // Focus defaults to cancel action per the widget spec
  const [focusedButton, setFocusedButton] = useState<'cancel' | 'confirm'>('cancel');

  useInput(
    (_input, key) => {
      if (key.tab) {
        setFocusedButton((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
      } else if (key.return) {
        if (focusedButton === 'cancel') {
          onCancel?.();
        } else {
          onConfirm?.();
        }
      }
    },
    { isActive: isFocused && open },
  );

  if (!open) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      {title && (
        <Box marginBottom={1}>
          <Text bold color="red">
            {'\u26A0'} {title}
          </Text>
        </Box>
      )}

      {/* Description */}
      {description && (
        <Box marginBottom={1}>
          <Text>{description}</Text>
        </Box>
      )}

      {/* Action buttons */}
      <Box gap={2}>
        <Box>
          <Text
            bold={focusedButton === 'cancel'}
            inverse={focusedButton === 'cancel'}
          >
            {' '}{cancelLabel}{' '}
          </Text>
        </Box>
        <Box>
          <Text
            bold={focusedButton === 'confirm'}
            inverse={focusedButton === 'confirm'}
            color={focusedButton === 'confirm' ? 'red' : undefined}
          >
            {' '}{confirmLabel}{' '}
          </Text>
        </Box>
      </Box>

      {/* Keyboard hint */}
      <Box marginTop={1}>
        <Text dimColor>Tab: switch focus  Enter: activate</Text>
      </Box>
    </Box>
  );
};

AlertDialog.displayName = 'AlertDialog';
export default AlertDialog;
