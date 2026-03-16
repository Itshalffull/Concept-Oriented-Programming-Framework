// ============================================================
// Clef Surface Ink Widget — NotationBadge
//
// Small badge displaying notation type or visual language
// indicator on canvas items.
// Adapts the notation-badge.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface NotationBadgeProps {
  /** Canvas identifier. */
  canvasId: string;
  /** Notation identifier. */
  notationId?: string;
  /** Display name of the notation. */
  notationName?: string;
  /** Icon identifier for the notation. */
  notationIcon?: string;
}

// --------------- Component ---------------

export const NotationBadge: React.FC<NotationBadgeProps> = ({
  canvasId,
  notationId,
  notationName,
}) => (
  <Box>
    <Text bold>[{notationName ?? notationId ?? canvasId}]</Text>
  </Box>
);

export default NotationBadge;
