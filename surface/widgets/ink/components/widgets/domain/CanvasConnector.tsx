// ============================================================
// Clef Surface Ink Widget — CanvasConnector
//
// Edge or arrow connecting two canvas nodes, rendered as ASCII
// line art in the terminal. Displays a directional connection
// between named endpoints with an optional label.
//
// Adapts the canvas-connector.widget spec: anatomy (root, path,
// startHandle, endHandle, label), states (idle, hovered,
// selected, draggingStart, draggingEnd, editingLabel, deleted),
// and connect attributes.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface CanvasConnectorProps {
  /** ID of the source node. */
  fromId: string;
  /** ID of the target node. */
  toId: string;
  /** Optional label displayed on the connection. */
  label?: string;
  /** Line style type. */
  type?: 'straight' | 'curved';
  /** Color of the connector line. */
  color?: string;
}

// --------------- Helpers ---------------

const LINE_STYLES: Record<string, string> = {
  straight: '\u2500\u2500\u2500\u2192',
  curved: '\u2500\u2500\u25CF',
};

// --------------- Component ---------------

export const CanvasConnector: React.FC<CanvasConnectorProps> = ({
  fromId,
  toId,
  label,
  type = 'straight',
  color,
}) => {
  const line = LINE_STYLES[type] || LINE_STYLES.straight;

  return (
    <Box>
      <Text dimColor>[{fromId}]</Text>
      <Text color={color as any}> {line} </Text>
      {label && <Text color={color as any}>({label}) </Text>}
      <Text dimColor>[{toId}]</Text>
    </Box>
  );
};

CanvasConnector.displayName = 'CanvasConnector';
export default CanvasConnector;
