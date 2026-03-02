// ============================================================
// Clef Surface Ink Widget — DragHandle
//
// Reorder handle rendered as a grip icon in the terminal.
// Displays a visual indicator for drag-and-drop reordering
// capability. Purely visual in terminal context since terminal
// drag is managed by parent containers via keyboard.
//
// Adapts the drag-handle.widget spec: anatomy (root, icon),
// states (idle, hovered, focused, grabbed, dragging), and
// connect attributes.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface DragHandleProps {
  /** Orientation of the drag handle. */
  orientation?: 'vertical' | 'horizontal';
  /** Whether the handle is disabled. */
  disabled?: boolean;
}

// --------------- Component ---------------

export const DragHandle: React.FC<DragHandleProps> = ({
  orientation = 'vertical',
  disabled = false,
}) => {
  const icon = orientation === 'vertical' ? '\u2801\u2802\u2803' : '\u2261';

  return (
    <Box>
      <Text dimColor={disabled} color={disabled ? 'gray' : undefined}>
        {icon}
      </Text>
    </Box>
  );
};

DragHandle.displayName = 'DragHandle';
export default DragHandle;
