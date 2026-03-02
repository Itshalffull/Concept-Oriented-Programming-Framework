// ============================================================
// Clef Surface Ink Widget — WorkflowNode
//
// Single node within a workflow graph rendered in the terminal
// as a bordered box with status icon, label, and input/output
// port listings. Status is indicated by icon and color.
//
// Adapts the workflow-node.widget spec: anatomy (root, header,
// icon, title, statusBadge, inputPorts, inputPort, outputPorts,
// outputPort, body), states, and connect attributes.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface WorkflowNodeProps {
  /** Unique identifier for the node. */
  id: string;
  /** Display label for the node. */
  label: string;
  /** Type of the workflow node. */
  type: string;
  /** Execution status of the node. */
  status?: 'idle' | 'running' | 'completed' | 'error';
  /** Input port names. */
  inputs?: string[];
  /** Output port names. */
  outputs?: string[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the node is selected. */
  onSelect?: (id: string) => void;
}

// --------------- Helpers ---------------

const STATUS_ICONS: Record<string, string> = {
  idle: '\u25CB',
  running: '\u25CE',
  completed: '\u25CF',
  error: '\u2716',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'gray',
  running: 'yellow',
  completed: 'green',
  error: 'red',
};

// --------------- Component ---------------

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({
  id,
  label,
  type,
  status = 'idle',
  inputs = [],
  outputs = [],
  isFocused = false,
  onSelect,
}) => {
  useInput(
    (input, key) => {
      if (!isFocused) return;
      if (key.return || input === ' ') {
        onSelect?.(id);
      }
    },
    { isActive: isFocused },
  );

  const statusIcon = STATUS_ICONS[status] || STATUS_ICONS.idle;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.idle;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : statusColor}
      paddingX={1}
    >
      {/* Header */}
      <Box>
        <Text color={statusColor as any}>[{statusIcon}] </Text>
        <Text bold color={isFocused ? 'cyan' : undefined}>
          {label}
        </Text>
        <Text dimColor> ({type})</Text>
      </Box>

      {/* Input ports */}
      {inputs.length > 0 && (
        <Box paddingLeft={1}>
          <Text dimColor>in: </Text>
          {inputs.map((port, i) => (
            <Text key={port} dimColor>
              {'\u25C0'}{port}
              {i < inputs.length - 1 ? ', ' : ''}
            </Text>
          ))}
        </Box>
      )}

      {/* Output ports */}
      {outputs.length > 0 && (
        <Box paddingLeft={1}>
          <Text dimColor>out: </Text>
          {outputs.map((port, i) => (
            <Text key={port} dimColor>
              {port}{'\u25B6'}
              {i < outputs.length - 1 ? ', ' : ''}
            </Text>
          ))}
        </Box>
      )}

      {/* Status line */}
      <Box>
        <Text color={statusColor as any} dimColor>
          Status: {status}
        </Text>
      </Box>
    </Box>
  );
};

WorkflowNode.displayName = 'WorkflowNode';
export default WorkflowNode;
