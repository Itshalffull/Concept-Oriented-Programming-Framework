import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface NotificationDef {
  id: string;
  title: string;
  body?: string;
  timestamp?: string;
  read?: boolean;
  type?: string;
}

export interface NotificationCenterProps {
  notifications: NotificationDef[];
  onRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClearAll?: () => void;
  style?: ViewStyle;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onRead,
  onDismiss,
  onClearAll,
  style,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Notifications</Text>
        {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
        {notifications.length > 0 && <Pressable onPress={onClearAll}><Text style={styles.clearText}>Clear all</Text></Pressable>}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => onRead?.(item.id)} style={[styles.item, !item.read && styles.unread]}>
            <View style={styles.itemContent}>
              <Text style={styles.title}>{item.title}</Text>
              {item.body && <Text style={styles.body}>{item.body}</Text>}
              {item.timestamp && <Text style={styles.timestamp}>{item.timestamp}</Text>}
            </View>
            <Pressable onPress={() => onDismiss?.(item.id)} hitSlop={8}><Text style={styles.dismiss}>\u00D7</Text></Pressable>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notifications</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  heading: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },
  badge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  clearText: { fontSize: 13, color: '#3b82f6' },
  item: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  unread: { backgroundColor: '#eff6ff' },
  itemContent: { flex: 1 },
  title: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  body: { fontSize: 13, color: '#475569', marginTop: 2 },
  timestamp: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  dismiss: { fontSize: 18, color: '#94a3b8', paddingLeft: 8 },
  empty: { padding: 24, textAlign: 'center', color: '#94a3b8' },
});

NotificationCenter.displayName = 'NotificationCenter';
export default NotificationCenter;
