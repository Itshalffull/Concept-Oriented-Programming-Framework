import React, { useEffect, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface ToastProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  icon?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  style?: ViewStyle;
}

export const Toast: React.FC<ToastProps> = ({
  variant = 'info',
  title,
  description,
  duration = 5000,
  dismissible = true,
  icon,
  action,
  onDismiss,
  style,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onDismiss?.(), duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const variantColors: Record<string, string> = {
    info: '#3b82f6', success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
  };

  return (
    <View
      style={[styles.root, { borderLeftColor: variantColors[variant] }, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <View style={styles.content}>
        {title && <Text style={styles.title}>{title}</Text>}
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      {action && <View style={styles.action}>{action}</View>}
      {dismissible && (
        <Pressable onPress={onDismiss} accessibilityLabel="Dismiss" hitSlop={8}>
          <Text style={styles.dismiss}>\u00D7</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderLeftWidth: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  icon: { marginRight: 8 },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  description: { fontSize: 13, color: '#475569', marginTop: 2 },
  action: { marginLeft: 8 },
  dismiss: { fontSize: 20, color: '#94a3b8', paddingLeft: 8 },
});

Toast.displayName = 'Toast';
export default Toast;
