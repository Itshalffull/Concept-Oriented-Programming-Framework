import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface WorkflowNodeDef { id: string; type: string; label: string; x?: number; y?: number; }
export interface WorkflowEdgeDef { id: string; source: string; target: string; label?: string; }

export interface WorkflowEditorProps {
  nodes: WorkflowNodeDef[]; edges: WorkflowEdgeDef[];
  onNodeSelect?: (id: string) => void; onEdgeSelect?: (id: string) => void;
  children?: ReactNode; style?: ViewStyle;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ nodes, edges, onNodeSelect, children, style }) => (
  <ScrollView horizontal style={[styles.root, style]}><ScrollView>
    <View style={styles.canvas} accessibilityRole="image" accessibilityLabel="Workflow editor">
      {nodes.map(node => (
        <View key={node.id} style={[styles.node, { left: node.x ?? 0, top: node.y ?? 0 }]}>
          <Text style={styles.nodeType}>{node.type}</Text>
          <Text style={styles.nodeLabel}>{node.label}</Text>
        </View>
      ))}
      {children}
    </View>
  </ScrollView></ScrollView>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  canvas: { width: 1200, height: 800, position: 'relative' },
  node: { position: 'absolute', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, minWidth: 120, alignItems: 'center' },
  nodeType: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  nodeLabel: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
});

WorkflowEditor.displayName = 'WorkflowEditor';
export default WorkflowEditor;
