import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface GaugeThresholds {
  warning?: number;
  danger?: number;
}

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  thresholds?: GaugeThresholds;
  label?: string;
  style?: ViewStyle;
}

export const Gauge: React.FC<GaugeProps> = ({
  value,
  min = 0,
  max = 100,
  thresholds,
  label,
  style,
}) => {
  const clamped = Math.min(Math.max(value, min), max);
  const percentage = ((clamped - min) / (max - min)) * 100;

  let color = '#22c55e';
  if (thresholds?.danger && clamped >= thresholds.danger) color = '#ef4444';
  else if (thresholds?.warning && clamped >= thresholds.warning) color = '#f59e0b';

  return (
    <View style={[styles.root, style]} accessibilityRole="progressbar" accessibilityValue={{ min, max, now: clamped }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.value}>{Math.round(clamped)}</Text>
        {label && <Text style={styles.label}>{label}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  track: { width: '100%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  labels: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', marginTop: 8, gap: 4 },
  value: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  label: { fontSize: 13, color: '#64748b' },
});

Gauge.displayName = 'Gauge';
export default Gauge;
