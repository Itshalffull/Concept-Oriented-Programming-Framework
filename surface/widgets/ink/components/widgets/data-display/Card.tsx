// ============================================================
// Clef Surface Ink Widget — Card
//
// Surface container that groups related content and actions into
// a single visual unit. Supports header, body, and footer regions
// with configurable elevation, fill, and outline variants.
// Terminal adaptation: bordered box with title in bold, optional
// description, children below.
// See widget spec: repertoire/widgets/data-display/card.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface CardProps {
  /** Primary heading text identifying the card content. */
  title?: string;
  /** Optional secondary text providing additional context. */
  description?: string;
  /** Card variant controlling visual presentation. */
  variant?: 'outline' | 'elevated' | 'filled';
  /** Size controlling internal padding. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional content rendered inside the card body. */
  children?: ReactNode;
}

// --------------- Helpers ---------------

const PADDING_MAP: Record<string, number> = {
  sm: 0,
  md: 1,
  lg: 2,
};

const BORDER_STYLES: Record<string, 'single' | 'double' | 'bold'> = {
  outline: 'single',
  elevated: 'double',
  filled: 'bold',
};

// --------------- Component ---------------

export const Card: React.FC<CardProps> = ({
  title,
  description,
  variant = 'outline',
  size = 'md',
  children,
}) => {
  const padding = PADDING_MAP[size] ?? 1;
  const borderStyle = BORDER_STYLES[variant] ?? 'single';

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      paddingX={padding}
      paddingY={padding > 0 ? 1 : 0}
    >
      {/* Header: title and description */}
      {title && (
        <Box flexDirection="column">
          <Text bold>{title}</Text>
          {description && (
            <Text dimColor>{description}</Text>
          )}
        </Box>
      )}

      {/* Body: children */}
      {children && (
        <Box flexDirection="column" marginTop={title ? 1 : 0}>
          {children}
        </Box>
      )}
    </Box>
  );
};

Card.displayName = 'Card';
export default Card;
