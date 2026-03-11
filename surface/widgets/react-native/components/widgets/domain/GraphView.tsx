import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface GraphNode { id: string; label: string; x?: number; y?: number; }
export interface GraphEdge { source: string; target: string; label?: string; }

export interface GraphViewProps {
  nodes: GraphNode[]; edges: GraphEdge[];
  onNodeSelect?: (id: string) => void; children?: ReactNode; style?: ViewStyle;
}

export const GraphView: React.FC<GraphViewProps> = ({ nodes, edges, children, style }) => (
  <ScrollView horizontal style={[styles.root, style]}><ScrollView>
    <View style={styles.canvas} accessibilityRole="image" accessibilityLabel="Graph view">
      {nodes.map(node => (
        <View key={node.id} style={[styles.node, { left: node.x ?? 0, top: node.y ?? 0 }]}><Text style={styles.nodeLabel}>{node.label}</Text></View>
      ))}
      {children}
    </View>
  </ScrollView></ScrollView>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvas: { width: 1000, height: 600, position: 'relative' },
  node: { position: 'absolute', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, minWidth: 80, alignItems: 'center' },
  nodeLabel: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
});

GraphView.displayName = 'GraphView';
export default GraphView;
