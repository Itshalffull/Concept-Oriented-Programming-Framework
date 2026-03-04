import React from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface TargetFieldDef { id: string; label: string; type: string; required?: boolean; }
export interface SourceFieldGroup { label: string; fields: { id: string; label: string; type: string; }[]; }
export interface MappingEntry { targetId: string; sourceId?: string; transform?: string; }

export interface FieldMapperProps {
  targets: TargetFieldDef[]; sources: SourceFieldGroup[]; mappings?: MappingEntry[];
  onMappingChange?: (mappings: MappingEntry[]) => void; style?: ViewStyle;
}

export const FieldMapper: React.FC<FieldMapperProps> = ({ targets, mappings = [], style }) => (
  <ScrollView style={[styles.root, style]}>
    <Text style={styles.heading}>Field Mapping</Text>
    {targets.map(t => {
      const mapping = mappings.find(m => m.targetId === t.id);
      return (
        <View key={t.id} style={styles.row}><Text style={styles.target}>{t.label}{t.required ? ' *' : ''}</Text><Text style={styles.arrow}>\u2190</Text><Text style={styles.source}>{mapping?.sourceId || 'Not mapped'}</Text></View>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  heading: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  target: { flex: 1, fontSize: 13, color: '#1e293b', fontWeight: '500' },
  arrow: { fontSize: 14, color: '#94a3b8' },
  source: { flex: 1, fontSize: 13, color: '#64748b' },
});

FieldMapper.displayName = 'FieldMapper';
export default FieldMapper;
