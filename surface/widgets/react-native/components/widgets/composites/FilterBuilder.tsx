import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface FieldDef { id: string; label: string; type: string; }
export interface OperatorDef { id: string; label: string; }
export interface FilterRow { id: string; field: string; operator: string; value: string; }
export interface FilterGroup { conjunction: 'and' | 'or'; rows: FilterRow[]; }

export interface FilterBuilderProps {
  fields: FieldDef[];
  operators?: OperatorDef[];
  filters?: FilterRow[];
  onFiltersChange?: (filters: FilterRow[]) => void;
  onApply?: () => void;
  onClear?: () => void;
  style?: ViewStyle;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  fields,
  filters = [],
  onFiltersChange,
  onApply,
  onClear,
  style,
}) => (
  <View style={[styles.root, style]}>
    <Text style={styles.heading}>Filters</Text>
    {filters.map((row, i) => (
      <View key={row.id} style={styles.row}>
        <Text style={styles.rowField}>{fields.find(f => f.id === row.field)?.label || row.field}</Text>
        <Text style={styles.rowOp}>{row.operator}</Text>
        <Text style={styles.rowValue}>{row.value}</Text>
      </View>
    ))}
    <View style={styles.actions}>
      {onApply && <Pressable onPress={onApply} style={styles.applyButton}><Text style={styles.applyText}>Apply</Text></Pressable>}
      {onClear && <Pressable onPress={onClear}><Text style={styles.clearText}>Clear</Text></Pressable>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  heading: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowField: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  rowOp: { fontSize: 13, color: '#64748b' },
  rowValue: { fontSize: 13, color: '#1e293b' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  applyButton: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#3b82f6', borderRadius: 6 },
  applyText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  clearText: { fontSize: 13, color: '#64748b', paddingVertical: 6 },
});

FilterBuilder.displayName = 'FilterBuilder';
export default FilterBuilder;
