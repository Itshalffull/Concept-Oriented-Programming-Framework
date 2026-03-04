import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface StatCardTrend {
  value: number;
  label?: string;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: StatCardTrend;
  footer?: ReactNode;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  footer,
  style,
}) => (
  <View style={[styles.root, style]} accessibilityRole="summary">
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {icon && <View style={styles.icon}>{icon}</View>}
    </View>
    <Text style={styles.value}>{value}</Text>
    {trend && (
      <View style={styles.trendRow}>
        <Text style={[styles.trendValue, { color: trend.value >= 0 ? '#22c55e' : '#ef4444' }]}>
          {trend.value >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(trend.value)}%
        </Text>
        {trend.label && <Text style={styles.trendLabel}>{trend.label}</Text>}
      </View>
    )}
    {footer && <View style={styles.footer}>{footer}</View>}
  </View>
);

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  icon: {},
  value: { fontSize: 28, fontWeight: '700', color: '#1e293b' },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  trendValue: { fontSize: 13, fontWeight: '500' },
  trendLabel: { fontSize: 12, color: '#94a3b8' },
  footer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
});

StatCard.displayName = 'StatCard';
export default StatCard;
