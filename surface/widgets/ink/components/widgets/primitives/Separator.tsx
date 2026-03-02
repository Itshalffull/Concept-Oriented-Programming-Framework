// ============================================================
// Clef Surface Ink Widget — Separator
//
// Visual divider that separates content sections in the
// terminal. Horizontal orientation renders a line of '─' chars;
// vertical orientation renders a single '│' character.
//
// Adapts the separator.widget spec: anatomy (root), states
// (static), and connect attributes (role, aria-orientation,
// data-part, data-orientation) to terminal rendering.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface SeparatorProps {
  /** Direction of the separator line. */
  orientation?: 'horizontal' | 'vertical';
  /** Whether the separator is purely decorative (aria role=none). */
  decorative?: boolean;
  /** Width in columns for horizontal orientation. */
  width?: number;
  /** Color of the separator line. */
  color?: string;
  /** data-part attribute. */
  dataPart?: string;
}

// --------------- Component ---------------

const HORIZONTAL_CHAR = '\u2500'; // ─
const VERTICAL_CHAR = '\u2502';   // │

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  decorative = false,
  width = 40,
  color,
  dataPart,
}) => {
  if (orientation === 'vertical') {
    return (
      <Box alignSelf="stretch" justifyContent="center">
        <Text dimColor={!color} color={color}>
          {VERTICAL_CHAR}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor={!color} color={color}>
        {HORIZONTAL_CHAR.repeat(width)}
      </Text>
    </Box>
  );
};

Separator.displayName = 'Separator';
export default Separator;
