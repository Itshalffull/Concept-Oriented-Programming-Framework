// ============================================================
// Clef Surface Ink Widget — Drawer
//
// Slide-in panel that overlays the page content. Functions as
// a modal dialog with focus trapping in a terminal context.
// Supports placement on any of the four edges (left, right,
// top, bottom) communicated via a position indicator label
// and border styling.
//
// Terminal adaptation: full-height bordered panel rendered
// inline. Position is indicated textually since terminals
// cannot anchor to screen edges. Escape to close.
// See widget spec: repertoire/widgets/feedback/drawer.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Position Configuration ---------------

const POSITION_INDICATORS: Record<string, string> = {
  left: '\u25C0 LEFT',    // ◀ LEFT
  right: 'RIGHT \u25B6',  // RIGHT ▶
  top: '\u25B2 TOP',      // ▲ TOP
  bottom: 'BOTTOM \u25BC', // BOTTOM ▼
};

const POSITION_BORDER_COLORS: Record<string, string> = {
  left: 'cyan',
  right: 'cyan',
  top: 'magenta',
  bottom: 'magenta',
};

// --------------- Props ---------------

export interface DrawerProps {
  /** Whether the drawer is open. */
  open?: boolean;
  /** Edge from which the drawer slides in. */
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** Title displayed in the drawer header. */
  title?: string;
  /** Content rendered inside the drawer body. */
  children?: ReactNode;
  /** Callback fired when the drawer is closed. */
  onClose?: () => void;
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
  /** Width of the drawer in columns (for left/right placement). */
  width?: number;
}

// --------------- Component ---------------

export const Drawer: React.FC<DrawerProps> = ({
  open = false,
  position = 'right',
  title,
  children,
  onClose,
  isFocused = true,
  width,
}) => {
  useInput(
    (_input, key) => {
      if (key.escape) {
        onClose?.();
      }
    },
    { isActive: isFocused && open },
  );

  if (!open) {
    return null;
  }

  const indicator = POSITION_INDICATORS[position] ?? POSITION_INDICATORS.right;
  const borderColor = POSITION_BORDER_COLORS[position] ?? 'cyan';
  const isHorizontal = position === 'left' || position === 'right';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      width={isHorizontal ? width : undefined}
    >
      {/* Header with position indicator, title, and close hint */}
      <Box>
        <Text dimColor>{indicator}</Text>
        <Box flexGrow={1} />
        {title && <Text bold>{title}</Text>}
        <Box flexGrow={1} />
        <Text dimColor>[Esc]</Text>
      </Box>

      {/* Separator */}
      <Text dimColor>{'─'.repeat((width ?? 40) - 4)}</Text>

      {/* Body content */}
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>

      {/* Footer */}
      <Text dimColor>{'─'.repeat((width ?? 40) - 4)}</Text>
      <Text dimColor>Esc: close drawer</Text>
    </Box>
  );
};

Drawer.displayName = 'Drawer';
export default Drawer;
