import React, { useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface NotificationAction {
  label: string;
  action: string;
}

export interface NotificationItemProps {
  title: string;
  description?: string;
  timestamp?: string;
  read?: boolean;
  icon?: ReactNode;
  actions?: NotificationAction[];
  onAction?: (action: string) => void;
  onPress?: () => void;
  style?: ViewStyle;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  title,
  description,
  timestamp,
  read = false,
  icon,
  actions = [],
  onAction,
  onPress,
  style,
}) => (
  <Pressable onPress={onPress} style={[styles.root, !read && styles.unread, style]} accessibilityRole="button">
    {!read && <View style={styles.dot} />}
    {icon && <View style={styles.icon}>{icon}</View>}
    <View style={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map(a => (
            <Pressable key={a.action} onPress={() => onAction?.(a.action)} style={styles.actionButton}>
              <Text style={styles.actionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  unread: { backgroundColor: '#eff6ff' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 8, marginTop: 4 },
  icon: { marginRight: 10 },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  description: { fontSize: 13, color: '#475569', marginTop: 2 },
  timestamp: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: '#f1f5f9' },
  actionText: { fontSize: 12, color: '#3b82f6', fontWeight: '500' },
});

NotificationItem.displayName = 'NotificationItem';
export default NotificationItem;
