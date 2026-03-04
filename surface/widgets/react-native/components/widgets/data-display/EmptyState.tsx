import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  style,
}) => (
  <View style={[styles.root, style]} accessibilityRole="text">
    {icon && <View style={styles.icon}>{icon}</View>}
    {title && <Text style={styles.title}>{title}</Text>}
    {description && <Text style={styles.description}>{description}</Text>}
    {action && <View style={styles.action}>{action}</View>}
  </View>
);

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4, textAlign: 'center' },
  description: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  action: {},
});

EmptyState.displayName = 'EmptyState';
export default EmptyState;
