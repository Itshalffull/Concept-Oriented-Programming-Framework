import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface BlockDef { id: string; type: string; content: string; }

export interface BlockEditorProps {
  blocks: BlockDef[];
  onAddBlock?: (afterId?: string) => void;
  onRemoveBlock?: (id: string) => void;
  onUpdateBlock?: (id: string, content: string) => void;
  onSelectBlock?: (id: string) => void;
  style?: ViewStyle;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  blocks, onAddBlock, onRemoveBlock, onUpdateBlock, onSelectBlock, style,
}) => (
  <ScrollView style={[styles.root, style]}>
    {blocks.map(block => (
      <Pressable key={block.id} onPress={() => onSelectBlock?.(block.id)} style={styles.block} accessibilityRole="button">
        <Text style={styles.blockType}>{block.type}</Text>
        <Text style={styles.blockContent}>{block.content}</Text>
        {onRemoveBlock && <Pressable onPress={() => onRemoveBlock(block.id)} hitSlop={8}><Text style={styles.remove}>\u00D7</Text></Pressable>}
      </Pressable>
    ))}
    {onAddBlock && <Pressable onPress={() => onAddBlock()} style={styles.addButton}><Text style={styles.addText}>+ Add Block</Text></Pressable>}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  block: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, marginBottom: 6 },
  blockType: { fontSize: 11, color: '#94a3b8', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8, textTransform: 'uppercase' },
  blockContent: { flex: 1, fontSize: 14, color: '#1e293b' },
  remove: { fontSize: 18, color: '#94a3b8', paddingLeft: 8 },
  addButton: { padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, borderStyle: 'dashed' },
  addText: { fontSize: 14, color: '#3b82f6' },
});

BlockEditor.displayName = 'BlockEditor';
export default BlockEditor;
