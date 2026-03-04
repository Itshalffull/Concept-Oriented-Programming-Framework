import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface LinkedRef {
  id: string;
  title: string;
  context?: string;
}

export interface UnlinkedRef {
  id: string;
  title: string;
  context?: string;
}

export interface BacklinkPanelProps {
  linked?: LinkedRef[];
  unlinked?: UnlinkedRef[];
  onRefClick?: (id: string) => void;
  onLink?: (id: string) => void;
  style?: ViewStyle;
}

export const BacklinkPanel: React.FC<BacklinkPanelProps> = ({
  linked = [],
  unlinked = [],
  onRefClick,
  onLink,
  style,
}) => {
  const [showUnlinked, setShowUnlinked] = useState(false);

  return (
    <View style={[styles.root, style]}>
      <Text style={styles.heading}>Linked References ({linked.length})</Text>
      {linked.map(ref => (
        <Pressable key={ref.id} onPress={() => onRefClick?.(ref.id)} style={styles.item} accessibilityRole="link">
          <Text style={styles.title}>{ref.title}</Text>
          {ref.context && <Text style={styles.context}>{ref.context}</Text>}
        </Pressable>
      ))}
      <Pressable onPress={() => setShowUnlinked(!showUnlinked)} style={styles.toggleButton}>
        <Text style={styles.toggleText}>Unlinked References ({unlinked.length}) {showUnlinked ? '\u25B2' : '\u25BC'}</Text>
      </Pressable>
      {showUnlinked && unlinked.map(ref => (
        <View key={ref.id} style={styles.item}>
          <Text style={styles.title}>{ref.title}</Text>
          {ref.context && <Text style={styles.context}>{ref.context}</Text>}
          <Pressable onPress={() => onLink?.(ref.id)} style={styles.linkButton}><Text style={styles.linkText}>Link</Text></Pressable>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { padding: 12 },
  heading: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  title: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  context: { fontSize: 13, color: '#64748b', marginTop: 2 },
  toggleButton: { paddingVertical: 10 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  linkButton: { marginTop: 4 },
  linkText: { fontSize: 12, color: '#3b82f6', fontWeight: '500' },
});

BacklinkPanel.displayName = 'BacklinkPanel';
export default BacklinkPanel;
