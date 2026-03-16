// ============================================================
// Clef Surface Ink Widget — ConstraintAnchorIndicator
//
// Visual indicator for layout constraint anchors on canvas nodes.
// Adapts the constraint-anchor-indicator.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface ConstraintAnchorIndicatorProps {
  /** Anchor identifier. */
  anchorId: string;
  /** Anchor position. */
  position?: 'top' | 'right' | 'bottom' | 'left';
  /** Whether the anchor is active. */
  active?: boolean;
  /** Whether the anchor is locked. */
  locked?: boolean;
}

// --------------- Component ---------------

export const ConstraintAnchorIndicator: React.FC<ConstraintAnchorIndicatorProps> = ({
  anchorId,
  position = 'top',
  active = false,
  locked = false,
}) => (
  <Box>
    <Text color={locked ? 'red' : active ? 'cyan' : 'gray'}>
      [{position}] {anchorId}{locked ? ' (locked)' : ''}
    </Text>
  </Box>
);

export default ConstraintAnchorIndicator;
