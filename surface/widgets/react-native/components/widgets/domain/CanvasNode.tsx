import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface CanvasNodeProps {
  x: number; y: number; width?: number; height?: number;
  label?: string; selected?: boolean;
  children?: ReactNode; style?: ViewStyle;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  x, y, width = 150, height = 60, label, selected = false, children, style,
}) => (
  <View style={[styles.root, { left: x, top: y, width, minHeight: height }, selected && styles.selected, style]} accessibilityRole="button" accessibilityLabel={label || 'Canvas node'}>
    {label && <Text style={styles.label}>{label}</Text>}
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { position: 'absolute', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, justifyContent: 'center', alignItems: 'center' },
  selected: { borderColor: '#3b82f6', borderWidth: 2, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  label: { fontSize: 13, fontWeight: '500', color: '#1e293b', textAlign: 'center' },
});

CanvasNode.displayName = 'CanvasNode';
export default CanvasNode;
