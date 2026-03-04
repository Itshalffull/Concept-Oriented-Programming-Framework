import React from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface MarkdownPreviewProps {
  content: string; style?: ViewStyle;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, style }) => (
  <ScrollView style={[styles.root, style]} accessibilityRole="text" accessibilityLabel="Markdown preview">
    <Text style={styles.text}>{content}</Text>
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 16 },
  text: { fontSize: 14, color: '#1e293b', lineHeight: 22 },
});

MarkdownPreview.displayName = 'MarkdownPreview';
export default MarkdownPreview;
