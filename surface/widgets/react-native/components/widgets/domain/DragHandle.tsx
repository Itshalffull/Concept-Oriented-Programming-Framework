import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface DragHandleProps {
  orientation?: 'horizontal' | 'vertical'; disabled?: boolean; style?: ViewStyle;
}

export const DragHandle: React.FC<DragHandleProps> = ({ orientation = 'vertical', disabled = false, style }) => (
  <View style={[styles.root, disabled && styles.disabled, style]} accessibilityRole="adjustable" accessibilityLabel="Drag handle">
    <Text style={[styles.dots, orientation === 'horizontal' && styles.horizontal]}>\u2801\u2801\u2801</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.3 },
  dots: { fontSize: 14, color: '#94a3b8', letterSpacing: 2 },
  horizontal: { transform: [{ rotate: '90deg' }] },
});

DragHandle.displayName = 'DragHandle';
export default DragHandle;
