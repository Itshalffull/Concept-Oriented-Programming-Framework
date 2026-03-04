import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface DataPoint { timestamp: number; value: number; }
export interface CacheMetrics { hitRate: number; totalKeys: number; memoryUsed: number; memoryTotal: number; }
export interface CacheKey { key: string; size: number; ttl: number; hits: number; }

export interface CacheDashboardProps {
  metrics?: CacheMetrics;
  keys?: CacheKey[];
  history?: DataPoint[];
  onEvict?: (key: string) => void;
  onClear?: () => void;
  style?: ViewStyle;
}

export const CacheDashboard: React.FC<CacheDashboardProps> = ({
  metrics,
  keys = [],
  onEvict,
  onClear,
  style,
}) => (
  <ScrollView style={[styles.root, style]}>
    {metrics && (
      <View style={styles.metricsRow}>
        <View style={styles.metric}><Text style={styles.metricValue}>{(metrics.hitRate * 100).toFixed(1)}%</Text><Text style={styles.metricLabel}>Hit Rate</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{metrics.totalKeys}</Text><Text style={styles.metricLabel}>Keys</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{Math.round(metrics.memoryUsed / 1024)}K</Text><Text style={styles.metricLabel}>Memory</Text></View>
      </View>
    )}
    <Text style={styles.sectionTitle}>Cache Keys ({keys.length})</Text>
    {keys.map(k => (
      <View key={k.key} style={styles.keyRow}>
        <Text style={styles.keyName}>{k.key}</Text>
        <Text style={styles.keyMeta}>{k.hits} hits</Text>
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metric: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  metricLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  keyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  keyName: { fontSize: 13, color: '#1e293b', fontFamily: 'monospace' },
  keyMeta: { fontSize: 12, color: '#94a3b8' },
});

CacheDashboard.displayName = 'CacheDashboard';
export default CacheDashboard;
