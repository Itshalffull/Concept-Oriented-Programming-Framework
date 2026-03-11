import React from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface QueueDataPoint { timestamp: number; value: number; }
export interface JobDef { id: string; name: string; status: string; createdAt?: string; }
export interface QueueStats { pending: number; active: number; completed: number; failed: number; }

export interface QueueDashboardProps {
  stats?: QueueStats;
  jobs?: JobDef[];
  history?: QueueDataPoint[];
  style?: ViewStyle;
}

export const QueueDashboard: React.FC<QueueDashboardProps> = ({
  stats, jobs = [], style,
}) => (
  <ScrollView style={[styles.root, style]}>
    {stats && (
      <View style={styles.statsRow}>
        {Object.entries(stats).map(([key, val]) => (
          <View key={key} style={styles.stat}><Text style={styles.statValue}>{val}</Text><Text style={styles.statLabel}>{key}</Text></View>
        ))}
      </View>
    )}
    <Text style={styles.sectionTitle}>Jobs ({jobs.length})</Text>
    {jobs.map(job => (
      <View key={job.id} style={styles.jobRow}>
        <Text style={styles.jobName}>{job.name}</Text>
        <Text style={styles.jobStatus}>{job.status}</Text>
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  statLabel: { fontSize: 11, color: '#64748b', textTransform: 'capitalize', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  jobRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  jobName: { fontSize: 13, color: '#1e293b' },
  jobStatus: { fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
});

QueueDashboard.displayName = 'QueueDashboard';
export default QueueDashboard;
