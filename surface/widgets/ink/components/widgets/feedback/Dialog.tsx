// ============================================================
// Clef Surface Ink Widget — Dialog
//
// Modal overlay that captures focus and blocks interaction with
// the underlying page until dismissed. Rendered as a
// double-bordered box with title bar, content area, and a
// close button indicator in the terminal.
//
// Terminal adaptation: overlays rendered inline; double border
// distinguishes dialog from regular content. Escape to close
// (when closeOnEscape is true). Title bar with [X] indicator.
// See widget spec: repertoire/widgets/feedback/dialog.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface DialogProps {
  /** Whether the dialog is open. */
  open?: boolean;
  /** Heading that labels the dialog. */
  title?: string;
  /** Supplementary text explaining the dialog purpose. */
  description?: string;
  /** Content rendered inside the dialog body. */
  children?: ReactNode;
  /** Whether pressing Escape closes the dialog. */
  closeOnEscape?: boolean;
  /** Callback fired when the dialog is closed. */
  onClose?: () => void;
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
  /** Width of the dialog in columns. */
  width?: number;
}

// --------------- Component ---------------

export const Dialog: React.FC<DialogProps> = ({
  open = false,
  title,
  description,
  children,
  closeOnEscape = true,
  onClose,
  isFocused = true,
  width,
}) => {
  useInput(
    (_input, key) => {
      if (key.escape && closeOnEscape) {
        onClose?.();
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
      borderStyle="double"
      borderColor="white"
      paddingX={2}
      paddingY={1}
      width={width}
    >
      {/* Title bar with close indicator */}
      {title && (
        <Box>
          <Text bold>{title}</Text>
          <Box flexGrow={1} />
          {closeOnEscape && (
            <Text dimColor>[{'\u2715'}]</Text>
          )}
        </Box>
      )}

      {/* Separator */}
      {title && (
        <Text dimColor>{'─'.repeat((width ?? 40) - 6)}</Text>
      )}

      {/* Description */}
      {description && (
        <Box marginTop={title ? 0 : 0} marginBottom={1}>
          <Text>{description}</Text>
        </Box>
      )}

      {/* Body content */}
      {children && (
        <Box flexDirection="column">
          {children}
        </Box>
      )}

      {/* Footer hint */}
      {closeOnEscape && (
        <Box marginTop={1}>
          <Text dimColor>Esc: close</Text>
        </Box>
      )}
    </Box>
  );
};

Dialog.displayName = 'Dialog';
export default Dialog;
