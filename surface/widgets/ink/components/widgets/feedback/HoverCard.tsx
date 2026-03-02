// ============================================================
// Clef Surface Ink Widget — HoverCard
//
// Preview card that displays richer content (e.g., user
// profile, link preview, resource summary) when triggered.
// In the terminal, there is no hover -- the card is entirely
// controlled via the `open` prop.
//
// Terminal adaptation: renders content in a bordered box below
// the trigger children when open. Non-modal, does not block
// other interaction.
// See widget spec: repertoire/widgets/feedback/hover-card.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface HoverCardProps {
  /** Whether the hover card is visible. */
  open?: boolean;
  /** Trigger element rendered inline. */
  children?: ReactNode;
  /** Content displayed inside the hover card surface. */
  content?: ReactNode;
  /** Width of the card in columns. */
  width?: number;
}

// --------------- Component ---------------

export const HoverCard: React.FC<HoverCardProps> = ({
  open = false,
  children,
  content,
  width = 36,
}) => {
  return (
    <Box flexDirection="column">
      {/* Trigger content (always rendered) */}
      {children}

      {/* Card content (rendered below trigger when open) */}
      {open && content && (
        <Box flexDirection="column" marginTop={0}>
          {/* Arrow pointer */}
          <Text> {'\u25BC'}</Text>

          {/* Card surface */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            paddingY={0}
            width={width}
          >
            {typeof content === 'string' ? <Text>{content}</Text> : content}
          </Box>
        </Box>
      )}
    </Box>
  );
};

HoverCard.displayName = 'HoverCard';
export default HoverCard;
