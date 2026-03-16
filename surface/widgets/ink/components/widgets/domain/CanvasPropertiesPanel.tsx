// ============================================================
// Clef Surface Ink Widget — CanvasPropertiesPanel
//
// Properties inspector panel for selected canvas items.
// Adapts the canvas-properties-panel.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface CanvasPropertiesPanelProps {
  /** Canvas identifier. */
  canvasId: string;
  /** Selected item ID. */
  selectedItemId?: string;
  /** Selected connector ID. */
  selectedConnectorId?: string;
  /** Type of selection. */
  selectionType?: 'none' | 'item' | 'connector' | 'canvas';
}

// --------------- Component ---------------

export const CanvasPropertiesPanel: React.FC<CanvasPropertiesPanelProps> = ({
  canvasId,
  selectedItemId,
  selectedConnectorId,
  selectionType = 'none',
}) => {
  const activeId = selectionType === 'item' ? selectedItemId : selectionType === 'connector' ? selectedConnectorId : canvasId;
  return (
    <Box flexDirection="column" borderStyle="single">
      <Text bold>Properties [{selectionType}]</Text>
      {activeId && <Text>ID: {activeId}</Text>}
    </Box>
  );
};

export default CanvasPropertiesPanel;
