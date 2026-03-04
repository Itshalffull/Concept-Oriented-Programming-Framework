import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface ChannelDef { id: string; label: string; }
export interface PreferenceDef { id: string; label: string; description?: string; }
export interface PreferenceGroupDef { id: string; label: string; preferences: PreferenceDef[]; }

export interface PreferenceMatrixProps {
  groups: PreferenceGroupDef[];
  channels: ChannelDef[];
  values: Record<string, Record<string, boolean>>;
  onChange?: (prefId: string, channelId: string, value: boolean) => void;
  readOnly?: boolean;
  style?: ViewStyle;
}

export const PreferenceMatrix: React.FC<PreferenceMatrixProps> = ({
  groups, channels, values, onChange, readOnly = false, style,
}) => (
  <ScrollView horizontal style={[styles.root, style]}>
    <View>
      <View style={styles.headerRow}>
        <View style={styles.labelCell}><Text style={styles.headerText}>Preference</Text></View>
        {channels.map(ch => <View key={ch.id} style={styles.channelCell}><Text style={styles.headerText}>{ch.label}</Text></View>)}
      </View>
      {groups.map(group => (
        <View key={group.id}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          {group.preferences.map(pref => (
            <View key={pref.id} style={styles.row}>
              <View style={styles.labelCell}>
                <Text style={styles.prefLabel}>{pref.label}</Text>
                {pref.description && <Text style={styles.prefDesc}>{pref.description}</Text>}
              </View>
              {channels.map(ch => {
                const on = values[pref.id]?.[ch.id] ?? false;
                return (
                  <Pressable key={ch.id} style={styles.channelCell} onPress={() => !readOnly && onChange?.(pref.id, ch.id, !on)} accessibilityRole="switch" accessibilityState={{ checked: on }}>
                    <Text style={styles.toggle}>{on ? '\u2611' : '\u2610'}</Text>
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
  labelCell: { width: 160, paddingHorizontal: 8 },
  channelCell: { width: 70, alignItems: 'center' },
  headerText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  groupLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  prefLabel: { fontSize: 13, color: '#1e293b' },
  prefDesc: { fontSize: 11, color: '#94a3b8' },
  toggle: { fontSize: 18 },
});

PreferenceMatrix.displayName = 'PreferenceMatrix';
export default PreferenceMatrix;
