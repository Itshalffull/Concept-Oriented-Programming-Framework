// ============================================================
// Clef Surface Ink Widget — LayoutControlPanel
//
// Panel for controlling canvas layout algorithm and parameters.
// Adapts the layout-control-panel.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface LayoutControlPanelProps {
  /** Active layout algorithm. */
  algorithm?: string;
  /** Whether the panel is visible. */
  visible?: boolean;
  /** Layout direction. */
  direction?: 'horizontal' | 'vertical' | 'radial';
  /** Spacing between nodes. */
  spacing?: number;
}

// --------------- Component ---------------

export const LayoutControlPanel: React.FC<LayoutControlPanelProps> = ({
  algorithm = 'force-directed',
  visible = true,
  direction = 'horizontal',
  spacing = 50,
}) => {
  if (!visible) return null;
  return (
    <Box flexDirection="column" borderStyle="single">
      <Text bold>Layout Control</Text>
      <Text>Algorithm: {algorithm}</Text>
      <Text>Direction: {direction}</Text>
      <Text>Spacing: {spacing}</Text>
    </Box>
  );
};

export default LayoutControlPanel;
