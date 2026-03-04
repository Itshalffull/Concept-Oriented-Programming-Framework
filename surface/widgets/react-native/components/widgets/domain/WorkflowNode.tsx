import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface PortDef { id: string; label: string; type: 'input' | 'output'; }

export interface WorkflowNodeProps {
  label: string; type?: string; selected?: boolean;
  ports?: PortDef[]; children?: ReactNode; style?: ViewStyle;
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ label, type, selected = false, ports = [], children, style }) => (
  <View style={[styles.root, selected && styles.selected, style]} accessibilityRole="button" accessibilityLabel={label}>
    <View style={styles.header}>
      {type && <Text style={styles.type}>{type}</Text>}
      <Text style={styles.label}>{label}</Text>
    </View>
    {ports.length > 0 && (
      <View style={styles.ports}>
        {ports.filter(p => p.type === 'input').map(p => <View key={p.id} style={styles.portIn}><Text style={styles.portLabel}>{p.label}</Text></View>)}
        {ports.filter(p => p.type === 'output').map(p => <View key={p.id} style={styles.portOut}><Text style={styles.portLabel}>{p.label}</Text></View>)}
      </View>
    )}
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, minWidth: 140, overflow: 'hidden' },
  selected: { borderColor: '#3b82f6', borderWidth: 2 },
  header: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  type: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  label: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  ports: { padding: 6 },
  portIn: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  portOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 },
  portLabel: { fontSize: 11, color: '#64748b' },
});

WorkflowNode.displayName = 'WorkflowNode';
export default WorkflowNode;
