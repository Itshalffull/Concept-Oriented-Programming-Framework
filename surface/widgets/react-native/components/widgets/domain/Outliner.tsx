import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface OutlineItem { id: string; label: string; children?: OutlineItem[]; }

export interface OutlinerProps {
  items: OutlineItem[]; onItemSelect?: (id: string) => void; style?: ViewStyle;
}

export const Outliner: React.FC<OutlinerProps> = ({ items, onItemSelect, style }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const renderItem = (item: OutlineItem, depth: number) => (
    <View key={item.id}>
      <Pressable onPress={() => { if (item.children?.length) toggle(item.id); onItemSelect?.(item.id); }} style={[styles.item, { paddingLeft: 12 + depth * 16 }]}>
        <Text style={styles.expander}>{item.children?.length ? (expanded.has(item.id) ? '\u25BC' : '\u25B6') : '  '}</Text>
        <Text style={styles.label}>{item.label}</Text>
      </Pressable>
      {expanded.has(item.id) && item.children?.map(child => renderItem(child, depth + 1))}
    </View>
  );

  return <View style={[styles.root, style]} accessibilityRole="list">{items.map(i => renderItem(i, 0))}</View>;
};

const styles = StyleSheet.create({
  root: {},
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  expander: { fontSize: 10, color: '#64748b', width: 16, textAlign: 'center' },
  label: { fontSize: 14, color: '#1e293b', marginLeft: 4 },
});

Outliner.displayName = 'Outliner';
export default Outliner;
