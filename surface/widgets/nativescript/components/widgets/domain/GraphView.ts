// ============================================================
// Clef Surface NativeScript Widget — GraphView
//
// Graph visualization with nodes and edges.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface GraphNode { id: string; label: string; x?: number; y?: number; }
export interface GraphEdge { id: string; source: string; target: string; label?: string; }

export interface GraphViewProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  selectedNodeId?: string;
  zoom?: number;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: string) => void;
}

export function createGraphView(props: GraphViewProps): StackLayout {
  const { nodes = [], edges = [], selectedNodeId, zoom = 1, onNodeClick, onEdgeClick } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-graph-view';
  container.accessibilityLabel = `Graph with ${nodes.length} nodes and ${edges.length} edges`;

  const info = new Label();
  info.text = `${nodes.length} nodes, ${edges.length} edges`;
  info.opacity = 0.6;
  info.fontSize = 12;
  container.addChild(info);

  for (const node of nodes) {
    const nodeView = new Label();
    nodeView.text = node.label;
    nodeView.className = node.id === selectedNodeId ? 'clef-graph-node-selected' : 'clef-graph-node';
    nodeView.padding = '4 8';
    nodeView.on('tap', () => onNodeClick?.(node.id));
    container.addChild(nodeView);
  }
  return container;
}

export default createGraphView;
