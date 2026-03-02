// ============================================================
// Clef Surface Ink Widget — Tooltip
//
// Lightweight floating label that provides supplementary
// descriptive text for a trigger element. In the terminal,
// the tooltip renders above or below the children with a
// directional pointer character.
//
// Terminal adaptation: content text rendered inline above or
// below children when visible. Uses directional pointers
// (triangle characters) to indicate association. Tooltips are
// non-interactive -- they contain no focusable elements.
// See widget spec: repertoire/widgets/feedback/tooltip.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface TooltipProps {
  /** Descriptive text displayed in the tooltip. */
  content: string;
  /** Whether the tooltip is visible. */
  visible?: boolean;
  /** Trigger element rendered inline. */
  children?: ReactNode;
  /** Placement of the tooltip relative to children. */
  placement?: 'top' | 'bottom';
}

// --------------- Component ---------------

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  visible = false,
  children,
  placement = 'top',
}) => {
  const tooltipContent = (
    <Box flexDirection="column">
      {placement === 'bottom' && (
        <Text dimColor> {'\u25B2'}</Text>
      )}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
      >
        <Text dimColor>{content}</Text>
      </Box>
      {placement === 'top' && (
        <Text dimColor> {'\u25BC'}</Text>
      )}
    </Box>
  );

  return (
    <Box flexDirection="column">
      {/* Tooltip above children */}
      {visible && placement === 'top' && tooltipContent}

      {/* Trigger children (always rendered) */}
      {children}

      {/* Tooltip below children */}
      {visible && placement === 'bottom' && tooltipContent}
    </Box>
  );
};

Tooltip.displayName = 'Tooltip';
export default Tooltip;
