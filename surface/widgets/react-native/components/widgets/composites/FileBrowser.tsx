import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface FileDef {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: string;
  children?: FileDef[];
}

export interface FileBrowserProps {
  files: FileDef[];
  onFileSelect?: (file: FileDef) => void;
  onNavigate?: (folderId: string) => void;
  style?: ViewStyle;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  files,
  onFileSelect,
  onNavigate,
  style,
}) => (
  <FlatList
    data={files}
    keyExtractor={item => item.id}
    style={[styles.root, style]}
    renderItem={({ item }) => (
      <Pressable
        onPress={() => item.type === 'folder' ? onNavigate?.(item.id) : onFileSelect?.(item)}
        style={styles.item}
        accessibilityRole="button"
      >
        <Text style={styles.icon}>{item.type === 'folder' ? '\u{1F4C1}' : '\u{1F4C4}'}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          {item.modified && <Text style={styles.meta}>{item.modified}</Text>}
        </View>
        {item.size != null && <Text style={styles.size}>{(item.size / 1024).toFixed(1)}K</Text>}
      </Pressable>
    )}
  />
);

const styles = StyleSheet.create({
  root: {},
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  icon: { fontSize: 20, marginRight: 10 },
  info: { flex: 1 },
  name: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  size: { fontSize: 12, color: '#94a3b8' },
});

FileBrowser.displayName = 'FileBrowser';
export default FileBrowser;
