import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'donut';
  data: ChartSeries[];
  width?: number;
  height?: number;
  showLegend?: boolean;
  onSegmentClick?: (series: string, index: number) => void;
  style?: ViewStyle;
}

export const Chart: React.FC<ChartProps> = ({
  type,
  data,
  width,
  height = 200,
  showLegend = true,
  onSegmentClick,
  style,
}) => {
  if (type === 'bar' && data.length > 0) {
    const allPoints = data.flatMap(s => s.data);
    const maxVal = Math.max(...allPoints.map(p => p.value), 1);
    return (
      <View style={[styles.root, { height }, style]} accessibilityRole="image" accessibilityLabel="Chart">
        <View style={styles.barContainer}>
          {allPoints.map((point, i) => (
            <View key={`${point.label}-${i}`} style={styles.barWrapper}>
              <View style={[styles.bar, { height: `${(point.value / maxVal) * 100}%`, backgroundColor: point.color || '#6366f1' }]} />
              <Text style={styles.barLabel}>{point.label}</Text>
            </View>
          ))}
        </View>
        {showLegend && (
          <View style={styles.legend}>
            {data.map(s => (
              <View key={s.name} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color || '#6366f1' }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { height }, style]} accessibilityRole="image" accessibilityLabel={`${type} chart`}>
      <Text style={styles.placeholder}>Chart ({type})</Text>
      {showLegend && data.length > 0 && (
        <View style={styles.legend}>
          {data.map(s => (
            <View key={s.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color || '#6366f1' }]} />
              <Text style={styles.legendText}>{s.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  barContainer: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  barWrapper: { flex: 1, alignItems: 'center' },
  bar: { width: '80%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 10, color: '#64748b', marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 12, color: '#475569' },
  placeholder: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
});

Chart.displayName = 'Chart';
export default Chart;
