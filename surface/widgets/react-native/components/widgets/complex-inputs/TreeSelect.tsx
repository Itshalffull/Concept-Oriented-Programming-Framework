import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface TreeNode { id: string; label: string; children?: TreeNode[]; disabled?: boolean; }

export interface TreeSelectProps {
  items: TreeNode[]; selectable?: boolean; multiSelect?: boolean; defaultExpanded?: string[]; label?: string; disabled?: boolean; value?: string[]; onChange?: (selectedIds: string[]) => void; style?: ViewStyle;
}

export const TreeSelect: React.FC<TreeSelectProps> = (props) => {
  const { items, selectable, multiSelect, defaultExpanded, label, disabled, value, onChange, style, style } = props;
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultExpanded));
  const [selected, setSelected] = useState<Set<string>>(new Set(value));
  const toggleExpand = useCallback((id: string) => { setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }, []);
  const toggleSelect = useCallback((id: string) => { if (disabled) return; setSelected(prev => { const next = new Set(prev); if (multiSelect) { next.has(id) ? next.delete(id) : next.add(id); } else { next.clear(); next.add(id); } onChange?.(Array.from(next)); return next; }); }, [disabled, multiSelect, onChange]);
  const renderNode = (node: TreeNode, depth: number) => (<View key={node.id}><Pressable onPress={() => { if (node.children?.length) toggleExpand(node.id); if (selectable) toggleSelect(node.id); }} style={[s.node, { paddingLeft: 12 + depth * 16 }]} accessibilityRole="treeitem"><Text style={s.expander}>{node.children?.length ? (expanded.has(node.id) ? '\u25BC' : '\u25B6') : '  '}</Text>{selectable && <Text style={s.checkbox}>{selected.has(node.id) ? '\u2611' : '\u2610'}</Text>}<Text style={s.nodeLabel}>{node.label}</Text></Pressable>{expanded.has(node.id) && node.children?.map(child => renderNode(child, depth + 1))}</View>);
  return (<View style={[s.root, style]} accessibilityRole="list" accessibilityLabel={label || 'Tree'}>{items.map(item => renderNode(item, 0))}</View>);
};

const s = StyleSheet.create({
  root: {}, node: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }, expander: { fontSize: 10, color: '#64748b', width: 16, textAlign: 'center' }, checkbox: { fontSize: 16, marginRight: 6 }, nodeLabel: { fontSize: 14, color: '#1e293b' }
});

TreeSelect.displayName = 'TreeSelect';
export default TreeSelect;
