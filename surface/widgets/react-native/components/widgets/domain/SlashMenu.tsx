import React, { useState, useMemo } from 'react';
import { View, Text, TextInput as RNTextInput, Pressable, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface BlockTypeDef { id: string; label: string; icon?: string; description?: string; }

export interface SlashMenuProps {
  items: BlockTypeDef[]; open?: boolean; query?: string;
  onSelect?: (id: string) => void; onClose?: () => void; style?: ViewStyle;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ items, open = false, query = '', onSelect, onClose, style }) => {
  const [searchQuery, setSearchQuery] = useState(query);
  const filtered = useMemo(() => searchQuery ? items.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase())) : items, [items, searchQuery]);

  if (!open) return null;

  return (
    <View style={[styles.root, style]}>
      <RNTextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Filter blocks..." style={styles.input} autoFocus placeholderTextColor="#94a3b8" />
      <FlatList data={filtered} keyExtractor={i => i.id} renderItem={({ item }) => (
        <Pressable onPress={() => onSelect?.(item.id)} style={styles.item} accessibilityRole="menuitem">
          {item.icon && <Text style={styles.icon}>{item.icon}</Text>}
          <View style={styles.info}><Text style={styles.label}>{item.label}</Text>{item.description && <Text style={styles.desc}>{item.description}</Text>}</View>
        </Pressable>
      )} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 240, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  input: { fontSize: 14, padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', color: '#1e293b' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  icon: { fontSize: 18, marginRight: 10 },
  info: { flex: 1 },
  label: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  desc: { fontSize: 12, color: '#64748b' },
});

SlashMenu.displayName = 'SlashMenu';
export default SlashMenu;
