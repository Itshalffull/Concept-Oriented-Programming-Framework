// ============================================================
// Clef Surface Ink Widget — CanvasNode
//
// Individual element on a canvas surface rendered as a bordered
// ASCII box in the terminal. Supports selection, label display,
// position info, and keyboard-driven interaction.
//
// Adapts the canvas-node.widget spec: anatomy (root, content,
// handles, handle, label), states (idle, hovered, selected,
// editing, dragging, resizing, deleted), and connect attributes.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface CanvasPosition {
  x: number;
  y: number;
}

// --------------- Props ---------------

export interface CanvasNodeProps {
  /** Unique identifier for the node. */
  id: string;
  /** Display label for the node. */
  label: string;
  /** Position of the node on the canvas. */
  position?: CanvasPosition;
  /** Whether the node is currently selected. */
  selected?: boolean;
  /** Visual type of the node. */
  type?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the node is selected. */
  onSelect?: (id: string) => void;
  /** Callback to move the node. */
  onMove?: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void;
}

// --------------- Component ---------------

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  id,
  label,
  position = { x: 0, y: 0 },
  selected = false,
  type,
  isFocused = false,
  onSelect,
  onMove,
}) => {
  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.return || input === ' ') {
        onSelect?.(id);
      } else if (key.upArrow) {
        onMove?.(id, 'up');
      } else if (key.downArrow) {
        onMove?.(id, 'down');
      } else if (key.leftArrow) {
        onMove?.(id, 'left');
      } else if (key.rightArrow) {
        onMove?.(id, 'right');
      }
    },
    { isActive: isFocused },
  );

  const isHighlighted = selected || isFocused;
  const borderColor = isHighlighted ? 'cyan' : 'gray';
  const typeLabel = type ? ` [${type}]` : '';

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="single"
        borderColor={borderColor}
        paddingX={1}
      >
        <Text
          inverse={selected}
          bold={isHighlighted}
          color={isHighlighted ? 'cyan' : undefined}
        >
          {label}{typeLabel}
        </Text>
      </Box>
      <Text dimColor>
        {'  '}({position.x},{position.y})
        {selected ? ' [selected]' : ''}
      </Text>
    </Box>
  );
};

CanvasNode.displayName = 'CanvasNode';
export default CanvasNode;
