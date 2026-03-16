// ============================================================
// Clef Surface Ink Widget — CanvasPanel
//
// Side panel for canvas tools and layer management.
// Adapts the canvas-panel.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface CanvasPanelProps {
  /** Panel title. */
  title?: string;
  /** Whether the panel is visible. */
  visible?: boolean;
  /** Panel position. */
  position?: 'left' | 'right';
}

// --------------- Component ---------------

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  title = 'Panel',
  visible = true,
  position = 'right',
}) => {
  if (!visible) return null;
  return (
    <Box flexDirection="column" borderStyle="single">
      <Text bold>[{position}] {title}</Text>
    </Box>
  );
};

export default CanvasPanel;
