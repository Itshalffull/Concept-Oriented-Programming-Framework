import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'relation';
export interface FieldDefinition { id: string; name: string; type: FieldType; required?: boolean; description?: string; }
export interface TypeDef { id: string; name: string; fields: FieldDefinition[]; }

export interface SchemaEditorProps {
  types: TypeDef[];
  selectedTypeId?: string;
  onSelectType?: (id: string) => void;
  onAddField?: (typeId: string) => void;
  onRemoveField?: (typeId: string, fieldId: string) => void;
  style?: ViewStyle;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  types, selectedTypeId, onSelectType, onAddField, onRemoveField, style,
}) => {
  const [activeType, setActiveType] = useState(selectedTypeId || types[0]?.id);
  const selected = types.find(t => t.id === activeType);

  return (
    <View style={[styles.root, style]}>
      <ScrollView horizontal style={styles.typeTabs}>
        {types.map(t => (
          <Pressable key={t.id} onPress={() => { setActiveType(t.id); onSelectType?.(t.id); }} style={[styles.typeTab, t.id === activeType && styles.activeTab]}>
            <Text style={[styles.typeTabText, t.id === activeType && styles.activeTabText]}>{t.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {selected && (
        <View style={styles.fields}>
          {selected.fields.map(field => (
            <View key={field.id} style={styles.fieldRow}>
              <Text style={styles.fieldName}>{field.name}{field.required ? ' *' : ''}</Text>
              <Text style={styles.fieldType}>{field.type}</Text>
              {onRemoveField && <Pressable onPress={() => onRemoveField(selected.id, field.id)} hitSlop={8}><Text style={styles.removeText}>\u00D7</Text></Pressable>}
            </View>
          ))}
          {onAddField && <Pressable onPress={() => onAddField(selected.id)} style={styles.addButton}><Text style={styles.addText}>+ Add field</Text></Pressable>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  typeTabs: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 12 },
  typeTab: { paddingVertical: 8, paddingHorizontal: 14 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  typeTabText: { fontSize: 14, color: '#64748b' },
  activeTabText: { color: '#3b82f6', fontWeight: '500' },
  fields: { padding: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  fieldName: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  fieldType: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  removeText: { fontSize: 18, color: '#94a3b8' },
  addButton: { paddingVertical: 10 },
  addText: { fontSize: 13, color: '#3b82f6' },
});

SchemaEditor.displayName = 'SchemaEditor';
export default SchemaEditor;
