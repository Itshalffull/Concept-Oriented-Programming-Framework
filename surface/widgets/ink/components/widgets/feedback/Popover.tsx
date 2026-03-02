// ============================================================
// Clef Surface Ink Widget — Popover
//
// Non-modal floating content panel anchored to a trigger
// element. Displays supplementary information or controls
// without blocking interaction with the rest of the page.
//
// Terminal adaptation: bordered popup box rendered inline
// below the trigger children when open. Escape to close.
// See widget spec: repertoire/widgets/feedback/popover.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface PopoverProps {
  /** Whether the popover is open. */
  open?: boolean;
  /** Optional heading labelling the popover content. */
  title?: string;
  /** Trigger element rendered inline. */
  children?: ReactNode;
  /** Content displayed inside the popover surface. */
  content?: ReactNode;
  /** Callback fired when the popover is closed. */
  onClose?: () => void;
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
  /** Width of the popover in columns. */
  width?: number;
}

// --------------- Component ---------------

export const Popover: React.FC<PopoverProps> = ({
  open = false,
  title,
  children,
  content,
  onClose,
  isFocused = true,
  width = 36,
}) => {
  useInput(
    (_input, key) => {
      if (key.escape) {
        onClose?.();
      }
    },
    { isActive: isFocused && open },
  );

  return (
    <Box flexDirection="column">
      {/* Trigger content (always rendered) */}
      {children}

      {/* Popover surface (rendered below trigger when open) */}
      {open && (
        <Box flexDirection="column" marginTop={0}>
          {/* Arrow pointer */}
          <Text> {'\u25BC'}</Text>

          {/* Popover box */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            paddingY={0}
            width={width}
          >
            {/* Title bar with close hint */}
            {title && (
              <>
                <Box>
                  <Text bold>{title}</Text>
                  <Box flexGrow={1} />
                  <Text dimColor>[Esc]</Text>
                </Box>
                <Text dimColor>{'─'.repeat(Math.max(1, width - 4))}</Text>
              </>
            )}

            {/* Content */}
            <Box flexDirection="column">
              {typeof content === 'string' ? <Text>{content}</Text> : content}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

Popover.displayName = 'Popover';
export default Popover;
