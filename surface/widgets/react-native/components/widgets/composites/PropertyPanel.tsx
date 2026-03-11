import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export type PropertyType = 'text' | 'number' | 'boolean' | 'select' | 'color';
export interface PropertyDef { id: string; label: string; type: PropertyType; value: unknown; options?: string[]; }

export interface PropertyPanelProps {
  properties: PropertyDef[];
  title?: string;
  onChange?: (id: string, value: unknown) => void;
  style?: ViewStyle;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  properties, title, onChange, style,
}) => (
  <ScrollView style={[styles.root, style]}>
    {title && <Text style={styles.title}>{title}</Text>}
    {properties.map(prop => (
      <View key={prop.id} style={styles.row}>
        <Text style={styles.label}>{prop.label}</Text>
        <Text style={styles.value}>{String(prop.value ?? '')}</Text>
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  title: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  value: { fontSize: 13, color: '#1e293b' },
});

PropertyPanel.displayName = 'PropertyPanel';
export default PropertyPanel;
