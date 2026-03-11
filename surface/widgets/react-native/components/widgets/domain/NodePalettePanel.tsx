import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface NodeTypeItem {
  type_key: string;
  label: string;
  shape: string;
  default_fill?: string;
  icon?: string;
}

export interface NodePalettePanelProps {
  notationId: string;
  notationName?: string;
  types: NodeTypeItem[];
  orientation?: 'horizontal' | 'vertical';
  onSelectType?: (typeKey: string) => void;
  style?: ViewStyle;
}

export const NodePalettePanel: React.FC<NodePalettePanelProps> = ({
  notationId, notationName = '', types, orientation = 'vertical', onSelectType, style,
}) => {
  const [query, setQuery] = useState('');
  const filtered = query
    ? types.filter(t => t.label.toLowerCase().includes(query.toLowerCase()))
    : types;

  return (
    <View style={[styles.root, style]} accessibilityRole="toolbar" accessibilityLabel="Node palette">
      {notationName !== '' && <Text style={styles.header}>{notationName}</Text>}
      <TextInput
        style={styles.search}
        placeholder="Search node types..."
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search node types"
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.type_key}
        numColumns={orientation === 'horizontal' ? undefined : 2}
        horizontal={orientation === 'horizontal'}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.typeItem, pressed && styles.typeItemPressed]}
            onPress={() => onSelectType?.(item.type_key)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.label} node`}
          >
            <View style={[styles.typeIcon, { backgroundColor: item.default_fill || '#e2e8f0' }]} />
            <Text style={styles.typeLabel} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        )}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', borderRightWidth: 1, borderColor: '#e2e8f0', padding: 12 },
  header: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  search: { height: 36, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 10, fontSize: 13, marginBottom: 10, backgroundColor: '#f8fafc' },
  grid: { paddingBottom: 12 },
  typeItem: { flex: 1, alignItems: 'center', padding: 10, margin: 4, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  typeItemPressed: { backgroundColor: '#e2e8f0' },
  typeIcon: { width: 32, height: 32, borderRadius: 6, marginBottom: 6 },
  typeLabel: { fontSize: 11, fontWeight: '500', color: '#475569', textAlign: 'center' },
});

NodePalettePanel.displayName = 'NodePalettePanel';
export default NodePalettePanel;
