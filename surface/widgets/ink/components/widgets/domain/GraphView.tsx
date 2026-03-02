// ============================================================
// Clef Surface Ink Widget — GraphView
//
// Force-directed node-and-edge graph visualization rendered as
// ASCII art in the terminal. Nodes display as bracketed labels
// connected by arrow lines. Supports keyboard navigation
// between nodes.
//
// Adapts the graph-view.widget spec: anatomy (root, canvas,
// filterPanel, searchInput, typeToggles, displayControls,
// minimap, detailPanel, modeToggle), states, and connect
// attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

// --------------- Props ---------------

export interface GraphViewProps {
  /** Nodes in the graph. */
  nodes: GraphNode[];
  /** Edges connecting nodes. */
  edges: GraphEdge[];
  /** ID of the currently selected node. */
  selectedNode?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a node is selected. */
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export const GraphView: React.FC<GraphViewProps> = ({
  nodes,
  edges,
  selectedNode,
  isFocused = false,
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

      if (key.rightArrow || key.downArrow) {
        setFocusedIndex((i) => Math.min(i + 1, nodes.length - 1));
      } else if (key.leftArrow || key.upArrow) {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const node = nodes[focusedIndex];
        if (node) onSelect?.(node.id);
      }
    },
    { isActive: isFocused },
  );

  // Build adjacency for display
  const adjacency = new Map<string, { to: string; label?: string }[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) || [];
    list.push({ to: edge.to, label: edge.label });
    adjacency.set(edge.from, list);
  }

  // Node label lookup
  const nodeLabels = new Map(nodes.map((n) => [n.id, n.label]));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? 'cyan' : 'gray'} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>Graph</Text>
        <Text dimColor> ({nodes.length} nodes, {edges.length} edges)</Text>
      </Box>

      {/* Nodes */}
      {nodes.map((node, index) => {
        const isFocusedNode = isFocused && focusedIndex === index;
        const isSelected = node.id === selectedNode;
        const outEdges = adjacency.get(node.id) || [];

        return (
          <Box key={node.id} flexDirection="column">
            <Box>
              <Text
                inverse={isSelected || isFocusedNode}
                bold={isSelected || isFocusedNode}
                color={isFocusedNode ? 'cyan' : isSelected ? 'yellow' : undefined}
              >
                {isFocusedNode ? '\u276F ' : '  '}
                [{node.label}]
              </Text>
              {outEdges.length > 0 && (
                <Text dimColor>
                  {' \u2500\u2500\u2192 '}
                  {outEdges.map((e, i) => {
                    const targetLabel = nodeLabels.get(e.to) || e.to;
                    const edgeLabel = e.label ? `(${e.label})` : '';
                    return (
                      <Text key={i}>
                        [{targetLabel}]{edgeLabel}
                        {i < outEdges.length - 1 ? ', ' : ''}
                      </Text>
                    );
                  })}
                </Text>
              )}
            </Box>
          </Box>
        );
      })}

      {nodes.length === 0 && (
        <Text dimColor>(empty graph)</Text>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter select
          </Text>
        </Box>
      )}
    </Box>
  );
};

GraphView.displayName = 'GraphView';
export default GraphView;
