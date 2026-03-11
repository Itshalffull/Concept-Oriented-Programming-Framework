import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface NotationBadgeProps {
  notationId?: string;
  notationName?: string;
  notationIcon?: string;
  canvasId: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const NotationBadge: React.FC<NotationBadgeProps> = ({
  notationId, notationName, canvasId, onPress, style,
}) => (
  <Pressable
    style={({ pressed }) => [styles.root, pressed && styles.pressed, style]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Notation: ${notationName ?? 'None'}`}
  >
    <View style={styles.icon} />
    <Text style={styles.label} numberOfLines={1}>{notationName ?? 'Freeform'}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  pressed: { backgroundColor: '#e2e8f0' },
  icon: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#94a3b8' },
  label: { fontSize: 12, fontWeight: '500', color: '#334155' },
});

NotationBadge.displayName = 'NotationBadge';
export default NotationBadge;
