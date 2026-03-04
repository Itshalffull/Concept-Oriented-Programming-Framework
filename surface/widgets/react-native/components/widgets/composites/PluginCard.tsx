import React, { type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export type PluginLifecycleState = 'installed' | 'active' | 'inactive' | 'error' | 'updating';

export interface PluginCardProps {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  icon?: ReactNode;
  state?: PluginLifecycleState;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onConfigure?: () => void;
  style?: ViewStyle;
}

export const PluginCard: React.FC<PluginCardProps> = ({
  name, description, version, author, icon, state = 'inactive', onActivate, onDeactivate, onConfigure, style,
}) => {
  const isActive = state === 'active';
  const stateColors: Record<string, string> = { active: '#22c55e', inactive: '#94a3b8', error: '#ef4444', updating: '#f59e0b', installed: '#3b82f6' };

  return (
    <View style={[styles.root, style]}>
      <View style={styles.header}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          {version && <Text style={styles.version}>v{version}</Text>}
        </View>
        <View style={[styles.stateBadge, { backgroundColor: stateColors[state] || '#94a3b8' }]}>
          <Text style={styles.stateText}>{state}</Text>
        </View>
      </View>
      {description && <Text style={styles.description}>{description}</Text>}
      {author && <Text style={styles.author}>by {author}</Text>}
      <View style={styles.actions}>
        {isActive ? (
          <Pressable onPress={onDeactivate} style={styles.actionButton}><Text style={styles.actionText}>Deactivate</Text></Pressable>
        ) : (
          <Pressable onPress={onActivate} style={[styles.actionButton, styles.primaryAction]}><Text style={styles.primaryText}>Activate</Text></Pressable>
        )}
        <Pressable onPress={onConfigure} style={styles.actionButton}><Text style={styles.actionText}>Configure</Text></Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon: { marginRight: 10 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  version: { fontSize: 12, color: '#94a3b8' },
  stateBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  stateText: { fontSize: 11, color: '#fff', fontWeight: '500', textTransform: 'capitalize' },
  description: { fontSize: 13, color: '#475569', marginBottom: 4 },
  author: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  primaryAction: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  actionText: { fontSize: 13, color: '#475569' },
  primaryText: { fontSize: 13, color: '#fff', fontWeight: '500' },
});

PluginCard.displayName = 'PluginCard';
export default PluginCard;
