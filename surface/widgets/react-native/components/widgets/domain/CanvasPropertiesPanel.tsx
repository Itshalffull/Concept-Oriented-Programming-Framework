import React from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export type SelectionType = 'none' | 'item' | 'connector' | 'canvas';

export interface CanvasPropertiesPanelProps {
  canvasId: string;
  selectionType?: SelectionType;
  selectedItemId?: string;
  selectedConnectorId?: string;
  itemProperties?: React.ReactNode;
  connectorProperties?: React.ReactNode;
  canvasProperties?: React.ReactNode;
  style?: ViewStyle;
}

export const CanvasPropertiesPanel: React.FC<CanvasPropertiesPanelProps> = ({
  canvasId, selectionType = 'none',
  selectedItemId, selectedConnectorId,
  itemProperties, connectorProperties, canvasProperties, style,
}) => (
  <View style={[styles.root, style]} accessibilityRole="summary" accessibilityLabel="Properties panel">
    {selectionType === 'none' && (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No Selection</Text>
        <Text style={styles.emptyText}>Select an item, connector, or the canvas to view properties.</Text>
      </View>
    )}

    {selectionType === 'item' && (
      <ScrollView style={styles.section} contentContainerStyle={styles.sectionContent} accessibilityLabel="Item properties">
        <Text style={styles.sectionTitle}>Item Properties</Text>
        {selectedItemId && <Text style={styles.fieldValue}>ID: {selectedItemId}</Text>}
        {itemProperties}
      </ScrollView>
    )}

    {selectionType === 'connector' && (
      <ScrollView style={styles.section} contentContainerStyle={styles.sectionContent} accessibilityLabel="Connector properties">
        <Text style={styles.sectionTitle}>Connector Properties</Text>
        {selectedConnectorId && <Text style={styles.fieldValue}>ID: {selectedConnectorId}</Text>}
        {connectorProperties}
      </ScrollView>
    )}

    {selectionType === 'canvas' && (
      <ScrollView style={styles.section} contentContainerStyle={styles.sectionContent} accessibilityLabel="Canvas properties">
        <Text style={styles.sectionTitle}>Canvas Properties</Text>
        {canvasProperties}
      </ScrollView>
    )}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', borderLeftWidth: 1, borderColor: '#e2e8f0' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 6 },
  emptyText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
  section: { flex: 1 },
  sectionContent: { padding: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  fieldValue: { fontSize: 11, color: '#64748b', marginBottom: 8, fontFamily: 'monospace' },
});

CanvasPropertiesPanel.displayName = 'CanvasPropertiesPanel';
export default CanvasPropertiesPanel;
