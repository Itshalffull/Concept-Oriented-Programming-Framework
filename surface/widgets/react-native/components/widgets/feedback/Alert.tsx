import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface AlertProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  description?: string;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
  icon,
  dismissible = false,
  onDismiss,
  children,
  style,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  const variantColors: Record<string, string> = {
    info: '#3b82f6',
    warning: '#f59e0b',
    error: '#ef4444',
    success: '#22c55e',
  };

  return (
    <View
      style={[styles.root, { borderLeftColor: variantColors[variant] }, style]}
      accessibilityRole="alert"
      accessibilityLabel={title || 'Alert'}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <View style={styles.content}>
        {title && <Text style={styles.title}>{title}</Text>}
        {description && <Text style={styles.description}>{description}</Text>}
        {children}
      </View>
      {dismissible && (
        <Pressable onPress={handleDismiss} accessibilityLabel="Dismiss alert" hitSlop={8}>
          <Text style={styles.dismiss}>\u00D7</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderLeftWidth: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
  },
  icon: { marginRight: 8 },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  description: { fontSize: 13, color: '#475569' },
  dismiss: { fontSize: 20, color: '#94a3b8', paddingLeft: 8 },
});

Alert.displayName = 'Alert';
export default Alert;
