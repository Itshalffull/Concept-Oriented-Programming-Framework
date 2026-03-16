// ============================================================
// Clef Surface Ink Widget — ConnectorPortIndicator
//
// Visual indicator for connection ports on canvas nodes.
// Adapts the connector-port-indicator.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface ConnectorPortIndicatorProps {
  /** Port identifier. */
  portId: string;
  /** Port direction. */
  direction?: 'input' | 'output' | 'bidirectional';
  /** Whether the port is connected. */
  connected?: boolean;
  /** Whether the port is highlighted during drag. */
  highlighted?: boolean;
}

// --------------- Component ---------------

export const ConnectorPortIndicator: React.FC<ConnectorPortIndicatorProps> = ({
  portId,
  direction = 'input',
  connected = false,
  highlighted = false,
}) => (
  <Box>
    <Text color={highlighted ? 'yellow' : connected ? 'green' : 'gray'}>
      {direction === 'input' ? '>' : direction === 'output' ? '<' : '<>'} {portId}
    </Text>
  </Box>
);

export default ConnectorPortIndicator;
