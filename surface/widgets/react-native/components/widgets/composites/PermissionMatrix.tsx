import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface RoleDef { id: string; label: string; }
export interface ResourceDef { id: string; label: string; }
export interface ActionDef { id: string; label: string; }
export type PermissionMap = Record<string, Record<string, Record<string, boolean>>>;

export interface PermissionMatrixProps {
  roles: RoleDef[];
  resources: ResourceDef[];
  actions: ActionDef[];
  permissions: PermissionMap;
  onToggle?: (roleId: string, resourceId: string, actionId: string, value: boolean) => void;
  readOnly?: boolean;
  style?: ViewStyle;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  roles, resources, actions, permissions, onToggle, readOnly = false, style,
}) => (
  <ScrollView horizontal style={[styles.root, style]}>
    <View>
      <View style={styles.headerRow}>
        <View style={styles.labelCell}><Text style={styles.headerText}>Resource</Text></View>
        {roles.map(role => <View key={role.id} style={styles.roleCell}><Text style={styles.headerText}>{role.label}</Text></View>)}
      </View>
      {resources.map(resource => (
        <View key={resource.id} style={styles.resourceSection}>
          <Text style={styles.resourceLabel}>{resource.label}</Text>
          {actions.map(action => (
            <View key={action.id} style={styles.row}>
              <View style={styles.labelCell}><Text style={styles.actionLabel}>{action.label}</Text></View>
              {roles.map(role => {
                const allowed = permissions[role.id]?.[resource.id]?.[action.id] ?? false;
                return (
                  <Pressable key={role.id} style={styles.roleCell} onPress={() => !readOnly && onToggle?.(role.id, resource.id, action.id, !allowed)} accessibilityRole="checkbox" accessibilityState={{ checked: allowed }}>
                    <Text style={styles.check}>{allowed ? '\u2611' : '\u2610'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  root: {},
  headerRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
  labelCell: { width: 120, paddingHorizontal: 8 },
  roleCell: { width: 80, alignItems: 'center', paddingHorizontal: 4 },
  headerText: { fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'center' },
  resourceSection: { marginTop: 8 },
  resourceLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b', paddingHorizontal: 8, paddingVertical: 4 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  actionLabel: { fontSize: 13, color: '#475569' },
  check: { fontSize: 18 },
});

PermissionMatrix.displayName = 'PermissionMatrix';
export default PermissionMatrix;
