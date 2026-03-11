export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent = | { type: 'HOVER_SEGMENT'; source: string } | { type: 'LEAVE' };
export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) {
    case 'idle': if (event.type === 'HOVER_SEGMENT') return 'segmentHovered'; return state;
    case 'segmentHovered': if (event.type === 'LEAVE') return 'idle'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';

export interface WeightSource {
  label: string;
  weight: number;
  type: WeightSourceType;
}

const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: '#3b82f6',
  delegation: '#8b5cf6',
  reputation: '#10b981',
  manual: '#f59e0b',
};

function prepareSegments(sources: WeightSource[], totalWeight: number) {
  const sorted = [...sources].sort((a, b) => b.weight - a.weight);
  return sorted.map((source) => ({
    ...source,
    percent: totalWeight > 0 ? (source.weight / totalWeight) * 100 : 0,
  }));
}

function formatWeight(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export interface WeightBreakdownProps {
  sources: WeightSource[];
  totalWeight: number;
  participant: string;
  variant?: 'bar' | 'donut';
  showLegend?: boolean;
  showTotal?: boolean;
}

const WeightBreakdown = forwardRef<View, WeightBreakdownProps>(function WeightBreakdown(
  { sources, totalWeight, participant, variant = 'bar', showLegend = true, showTotal = true }, ref,
) {
  const [state, send] = useReducer(weightBreakdownReducer, 'idle');
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const segments = useMemo(() => prepareSegments(sources, totalWeight), [sources, totalWeight]);

  const handleSegmentEnter = useCallback((label: string) => {
    setHoveredSource(label);
    send({ type: 'HOVER_SEGMENT', source: label });
  }, []);

  const handleSegmentLeave = useCallback(() => {
    setHoveredSource(null);
    send({ type: 'LEAVE' });
  }, []);

  const tooltipSegment = useMemo(
    () => (hoveredSource ? segments.find((s) => s.label === hoveredSource) : null),
    [hoveredSource, segments],
  );

  return (
    <View ref={ref} testID="weight-breakdown" accessibilityRole="none" accessibilityLabel={`Weight breakdown for ${participant}: ${formatWeight(totalWeight)} total`} style={s.root}>
      <Text style={s.title}>{participant}</Text>
      {showTotal && <Text style={s.total} accessibilityLabel={`Total weight: ${formatWeight(totalWeight)}`}>Total weight: {formatWeight(totalWeight)}</Text>}
      <View style={s.bar} accessibilityRole="image" accessibilityLabel="Weight distribution">
        {segments.map((seg, i) => (
          <Pressable
            key={seg.label}
            onPressIn={() => handleSegmentEnter(seg.label)}
            onPressOut={handleSegmentLeave}
            accessibilityLabel={`${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`}
            style={[s.segment, {
              width: `${seg.percent}%` as any,
              backgroundColor: SOURCE_COLORS[seg.type],
              opacity: hoveredSource && hoveredSource !== seg.label ? 0.5 : 1,
            }]}
          />
        ))}
      </View>
      {showLegend && (
        <View style={s.legend}>
          {segments.map((seg) => (
            <View key={seg.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: SOURCE_COLORS[seg.type] }]} />
              <Text style={s.legendLabel}>{seg.label}</Text>
              <Text style={s.legendPercent}> {formatWeight(seg.percent)}%</Text>
              <Text style={s.legendValue}> ({formatWeight(seg.weight)})</Text>
            </View>
          ))}
        </View>
      )}
      {state === 'segmentHovered' && tooltipSegment && (
        <View style={s.tooltip} accessibilityRole="none" accessibilityLabel={`${tooltipSegment.label}: ${formatWeight(tooltipSegment.weight)}`}>
          <Text style={s.tooltipLabel}>{tooltipSegment.label}</Text>
          <Text style={s.tooltipType}>{tooltipSegment.type}</Text>
          <Text style={s.tooltipValue}>{formatWeight(tooltipSegment.weight)} ({formatWeight(tooltipSegment.percent)}%)</Text>
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  total: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  bar: { height: 8, flexDirection: 'row', borderRadius: 4, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  segment: { height: '100%' as any },
  legend: { marginTop: 8, gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: '600' },
  legendPercent: { fontSize: 12, color: '#6b7280' },
  legendValue: { fontSize: 12, color: '#9ca3af' },
  tooltip: { position: 'absolute', top: 0, right: 0, padding: 8, backgroundColor: '#1f2937', borderRadius: 6 },
  tooltipLabel: { color: '#f9fafb', fontWeight: '600', fontSize: 12 },
  tooltipType: { color: '#9ca3af', fontSize: 11 },
  tooltipValue: { color: '#f9fafb', fontSize: 12 },
});

WeightBreakdown.displayName = 'WeightBreakdown';
export { WeightBreakdown };
export default WeightBreakdown;
