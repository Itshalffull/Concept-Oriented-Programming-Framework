import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface SortFieldDef { id: string; label: string; }
export interface SortCriterion { field: string; direction: 'asc' | 'desc'; }

export interface SortBuilderProps {
  fields: SortFieldDef[];
  criteria?: SortCriterion[];
  onCriteriaChange?: (criteria: SortCriterion[]) => void;
  onApply?: () => void;
  style?: ViewStyle;
}

export const SortBuilder: React.FC<SortBuilderProps> = ({
  fields, criteria = [], onCriteriaChange, onApply, style,
}) => (
  <View style={[styles.root, style]}>
    <Text style={styles.heading}>Sort by</Text>
    {criteria.map((c, i) => (
      <View key={i} style={styles.row}>
        <Text style={styles.field}>{fields.find(f => f.id === c.field)?.label || c.field}</Text>
        <Text style={styles.direction}>{c.direction === 'asc' ? '\u25B2 Ascending' : '\u25BC Descending'}</Text>
      </View>
    ))}
    {onApply && <Pressable onPress={onApply} style={styles.applyButton}><Text style={styles.applyText}>Apply</Text></Pressable>}
  </View>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  heading: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  field: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  direction: { fontSize: 13, color: '#64748b' },
  applyButton: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#3b82f6', borderRadius: 6, alignSelf: 'flex-start' },
  applyText: { fontSize: 13, color: '#fff', fontWeight: '500' },
});

SortBuilder.displayName = 'SortBuilder';
export default SortBuilder;
