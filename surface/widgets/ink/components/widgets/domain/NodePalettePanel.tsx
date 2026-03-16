// ============================================================
// Clef Surface Ink Widget — NodePalettePanel
//
// Palette panel for selecting node types to add to canvas.
// Adapts the node-palette-panel.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface NodePalettePanelProps {
  /** Available node types. */
  nodeTypes?: Array<{ id: string; label: string; category?: string }>;
  /** Whether the panel is visible. */
  visible?: boolean;
  /** Filter query. */
  filter?: string;
}

// --------------- Component ---------------

export const NodePalettePanel: React.FC<NodePalettePanelProps> = ({
  nodeTypes = [],
  visible = true,
  filter = '',
}) => {
  if (!visible) return null;
  const filtered = filter
    ? nodeTypes.filter((n) => n.label.toLowerCase().includes(filter.toLowerCase()))
    : nodeTypes;
  return (
    <Box flexDirection="column" borderStyle="single">
      <Text bold>Node Palette</Text>
      {filtered.map((nodeType) => (
        <Text key={nodeType.id}>  {nodeType.label}</Text>
      ))}
      {filtered.length === 0 && <Text dimColor>No node types</Text>}
    </Box>
  );
};

export default NodePalettePanel;
