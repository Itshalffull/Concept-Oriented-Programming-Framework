// ============================================================
// Clef Surface Ink Widget — WorkflowEditor
//
// Node-graph workflow canvas rendered in the terminal as an
// ASCII diagram of connected nodes. Supports keyboard-driven
// navigation, node selection, and displays connections between
// nodes.
//
// Adapts the workflow-editor.widget spec: anatomy (root, canvas,
// nodePalette, configPanel, minimap, toolbar, executeButton),
// states (idle, nodeSelected, configuring, placing, draggingNew,
// executing, executionResult), and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface WorkflowEditorNode {
  id: string;
  type: string;
  label: string;
  position?: { x: number; y: number };
}

export interface WorkflowConnection {
  from: string;
  to: string;
}

// --------------- Props ---------------

export interface WorkflowEditorProps {
  /** Nodes in the workflow graph. */
  nodes: WorkflowEditorNode[];
  /** Connections between nodes. */
  connections: WorkflowConnection[];
  /** ID of the currently selected node. */
  selectedNode?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new node. */
  onAddNode?: () => void;
  /** Callback to remove a node by id. */
  onRemoveNode?: (id: string) => void;
  /** Callback to create a connection. */
  onConnect?: (from: string, to: string) => void;
  /** Callback when a node is selected. */
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  nodes,
  connections,
  selectedNode,
  isFocused = false,
  onAddNode,
  onRemoveNode,
  onConnect,
  onSelect,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(() => {
    if (selectedNode) {
      const idx = nodes.findIndex((n) => n.id === selectedNode);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow || key.rightArrow) {
        setFocusedIndex((i) => Math.min(i + 1, nodes.length - 1));
      } else if (key.upArrow || key.leftArrow) {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const node = nodes[focusedIndex];
        if (node) onSelect?.(node.id);
      } else if (key.delete || key.backspace) {
        const node = nodes[focusedIndex];
        if (node) onRemoveNode?.(node.id);
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (input === 'n') {
        onAddNode?.();
      }
    },
    { isActive: isFocused },
  );

  // Build adjacency
  const adjacency = new Map<string, string[]>();
  for (const conn of connections) {
    const list = adjacency.get(conn.from) || [];
    list.push(conn.to);
    adjacency.set(conn.from, list);
  }

  const nodeLabels = new Map(nodes.map((n) => [n.id, n.label]));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? 'cyan' : 'gray'} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>Workflow</Text>
        <Text dimColor> ({nodes.length} nodes, {connections.length} connections)</Text>
      </Box>

      {/* Node list with connections */}
      {nodes.map((node, index) => {
        const isFocusedNode = isFocused && focusedIndex === index;
        const isSelected = node.id === selectedNode;
        const targets = adjacency.get(node.id) || [];

        return (
          <Box key={node.id} flexDirection="column">
            <Box>
              <Text
                inverse={isSelected || isFocusedNode}
                bold={isSelected || isFocusedNode}
                color={isFocusedNode ? 'cyan' : isSelected ? 'yellow' : undefined}
              >
                {isFocusedNode ? '\u276F ' : '  '}
                [{node.type}] {node.label}
              </Text>
            </Box>
            {targets.map((targetId, ti) => {
              const targetLabel = nodeLabels.get(targetId) || targetId;
              return (
                <Box key={ti} paddingLeft={4}>
                  <Text dimColor>
                    {'\u2514\u2500\u2500\u2192'} {targetLabel}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}

      {nodes.length === 0 && (
        <Text dimColor>(empty workflow)</Text>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter select {'  '} Del remove
            {'  '} n add node
          </Text>
        </Box>
      )}
    </Box>
  );
};

WorkflowEditor.displayName = 'WorkflowEditor';
export default WorkflowEditor;
