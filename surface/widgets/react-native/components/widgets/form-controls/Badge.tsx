import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface BadgeProps {
  label?: string;
  variant?: 'filled' | 'outline' | 'dot';
  color?: string;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const sizeStyles = { sm: { fontSize: 10, px: 4, py: 1 }, md: { fontSize: 12, px: 6, py: 2 }, lg: { fontSize: 14, px: 8, py: 3 } };

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'filled', color, max, size = 'md', style }) => {
  const isDot = variant === 'dot';
  const s = sizeStyles[size];
  const resolvedLabel = (() => {
    if (isDot) return '';
    if (max !== undefined && label !== undefined) {
      const num = Number(label);
      if (!Number.isNaN(num) && num > max) return `${max}+`;
    }
    return label ?? '';
  })();
  const bgColor = color || '#3b82f6';

  if (isDot) {
    return (
      <View style={[styles.dot, { backgroundColor: bgColor }, style]} accessibilityRole="text" accessibilityLabel="Status indicator" />
    );
  }

  return (
    <View
      style={[
        styles.root,
        variant === 'filled' ? { backgroundColor: bgColor } : { borderWidth: 1, borderColor: bgColor },
        { paddingHorizontal: s.px, paddingVertical: s.py },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label || 'Badge'}
    >
      <Text style={[styles.label, { fontSize: s.fontSize, color: variant === 'filled' ? '#fff' : bgColor }]}>{resolvedLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { borderRadius: 10, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontWeight: '600', textAlign: 'center' },
});

Badge.displayName = 'Badge';
export default Badge;
