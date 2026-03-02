// ============================================================
// Clef Surface Ink Widget — Badge
//
// Compact status indicator or count display for terminal.
// Renders as a colored text label, outline tag, or subtle
// marker. Maps the badge.widget anatomy (root, label) to
// Ink Box/Text with color prop support.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface BadgeProps {
  /** Visual variant of the badge. */
  variant?: 'filled' | 'outline' | 'subtle';
  /** Size controlling padding. */
  size?: 'sm' | 'md' | 'lg';
  /** Ink color string applied to the badge. */
  color?: string;
  /** Badge content (text label or count). */
  children?: React.ReactNode;
}

// --------------- Size Mapping ---------------

const SIZE_PADDING: Record<string, { px: number }> = {
  sm: { px: 0 },
  md: { px: 1 },
  lg: { px: 2 },
};

// --------------- Component ---------------

export const Badge: React.FC<BadgeProps> = ({
  variant = 'filled',
  size = 'md',
  color = 'green',
  children,
}) => {
  const pad = SIZE_PADDING[size] || SIZE_PADDING.md;
  const label = children != null ? String(children) : '';

  if (variant === 'filled') {
    return (
      <Box>
        <Text color="white" backgroundColor={color}>
          {pad.px > 0 ? ' '.repeat(pad.px) : ''}
          {label}
          {pad.px > 0 ? ' '.repeat(pad.px) : ''}
        </Text>
      </Box>
    );
  }

  if (variant === 'outline') {
    return (
      <Box>
        <Text color={color}>
          [{pad.px > 0 ? ' '.repeat(pad.px) : ''}{label}{pad.px > 0 ? ' '.repeat(pad.px) : ''}]
        </Text>
      </Box>
    );
  }

  // subtle
  return (
    <Box>
      <Text color={color} dimColor>
        {pad.px > 0 ? ' '.repeat(pad.px) : ''}{label}{pad.px > 0 ? ' '.repeat(pad.px) : ''}
      </Text>
    </Box>
  );
};

Badge.displayName = 'Badge';
export default Badge;
