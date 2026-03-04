import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface FieldDef { id: string; label: string; type: string; }
export interface ConditionRow { id: string; field: string; operator: string; value: string; }

export interface ConditionBuilderProps {
  fields: FieldDef[]; conditions?: ConditionRow[]; conjunction?: 'and' | 'or';
  onConditionsChange?: (conditions: ConditionRow[]) => void; onAdd?: () => void;
  style?: ViewStyle;
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  fields, conditions = [], conjunction = 'and', onAdd, style,
}) => (
  <View style={[styles.root, style]}>
    {conditions.map((c, i) => (
      <View key={c.id}>
        {i > 0 && <Text style={styles.conjunction}>{conjunction.toUpperCase()}</Text>}
        <View style={styles.row}><Text style={styles.field}>{fields.find(f => f.id === c.field)?.label || c.field}</Text><Text style={styles.op}>{c.operator}</Text><Text style={styles.val}>{c.value}</Text></View>
      </View>
    ))}
    {onAdd && <Pressable onPress={onAdd} style={styles.addButton}><Text style={styles.addText}>+ Add condition</Text></Pressable>}
  </View>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  field: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  op: { fontSize: 13, color: '#64748b' },
  val: { fontSize: 13, color: '#1e293b' },
  conjunction: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textAlign: 'center', paddingVertical: 4 },
  addButton: { paddingVertical: 10 },
  addText: { fontSize: 13, color: '#3b82f6' },
});

ConditionBuilder.displayName = 'ConditionBuilder';
export default ConditionBuilder;
