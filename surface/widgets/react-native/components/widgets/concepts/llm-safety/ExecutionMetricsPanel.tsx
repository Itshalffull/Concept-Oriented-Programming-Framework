export type ExecutionMetricsPanelState = 'idle' | 'updating';
export type ExecutionMetricsPanelEvent =
  | { type: 'UPDATE' }
  | { type: 'UPDATE_COMPLETE' };

export function executionMetricsPanelReducer(state: ExecutionMetricsPanelState, event: ExecutionMetricsPanelEvent): ExecutionMetricsPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'UPDATE') return 'updating';
      return state;
    case 'updating':
      if (event.type === 'UPDATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useReducer, useEffect, useRef, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface ExecutionMetricsPanelProps {
  totalTokens: number;
  totalCost: number;
  stepCount: number;
  errorRate: number;
  tokenLimit?: number | undefined;
  showLatency?: boolean;
  compact?: boolean;
  latencyAvg?: number | undefined;
  latencyP95?: number | undefined;
  children?: ReactNode;
}

function tokenGaugeColor(totalTokens: number, tokenLimit: number | undefined): string {
  if (tokenLimit == null || tokenLimit <= 0) return 'green';
  const pct = (totalTokens / tokenLimit) * 100;
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'yellow';
  return 'green';
}

function errorRateColor(rate: number): string {
  if (rate >= 5) return 'red';
  if (rate >= 1) return 'yellow';
  return 'green';
}

const COLOR_MAP: Record<string, string> = {
  red: '#dc2626',
  yellow: '#ca8a04',
  green: '#16a34a',
};

const ExecutionMetricsPanel = forwardRef<View, ExecutionMetricsPanelProps>(function ExecutionMetricsPanel(
  {
    totalTokens, totalCost, stepCount, errorRate: errorRateProp,
    tokenLimit, showLatency = true, compact = false,
    latencyAvg, latencyP95, children,
  },
  ref,
) {
  const [state, send] = useReducer(executionMetricsPanelReducer, 'idle');
  const prevValuesRef = useRef({ totalTokens, totalCost, stepCount, errorRate: errorRateProp });

  useEffect(() => {
    const prev = prevValuesRef.current;
    if (
      prev.totalTokens !== totalTokens ||
      prev.totalCost !== totalCost ||
      prev.stepCount !== stepCount ||
      prev.errorRate !== errorRateProp
    ) {
      send({ type: 'UPDATE' });
      const timer = setTimeout(() => send({ type: 'UPDATE_COMPLETE' }), 300);
      prevValuesRef.current = { totalTokens, totalCost, stepCount, errorRate: errorRateProp };
      return () => clearTimeout(timer);
    }
  }, [totalTokens, totalCost, stepCount, errorRateProp]);

  const tokenPct = tokenLimit != null && tokenLimit > 0
    ? Math.min((totalTokens / tokenLimit) * 100, 100)
    : null;

  const gaugeColor = tokenGaugeColor(totalTokens, tokenLimit);
  const errColor = errorRateColor(errorRateProp);

  return (
    <View
      ref={ref}
      testID="execution-metrics-panel"
      accessibilityRole="none"
      accessibilityLabel="Execution metrics"
      style={[s.root, compact && s.rootCompact]}
    >
      {/* Step counter */}
      <View style={s.card} accessibilityRole="none" accessibilityLabel={`Steps: ${stepCount}`}>
        <Text style={s.cardLabel}>Steps</Text>
        <Text style={s.cardValue}>{stepCount}</Text>
      </View>

      {/* Token gauge */}
      <View style={s.card} accessibilityRole="none" accessibilityLabel={`Tokens: ${totalTokens}`}>
        <Text style={s.cardLabel}>Tokens</Text>
        <Text style={s.cardValue}>
          {totalTokens.toLocaleString()}{tokenLimit != null ? ` / ${tokenLimit.toLocaleString()}` : ''}
        </Text>
        {tokenPct != null && (
          <View style={s.gaugeTrack}>
            <View style={[s.gaugeFill, { width: `${tokenPct}%` as any, backgroundColor: COLOR_MAP[gaugeColor] }]} />
          </View>
        )}
        {tokenPct != null && (
          <Text style={s.gaugePct}>{tokenPct.toFixed(1)}%</Text>
        )}
      </View>

      {/* Cost display */}
      <View style={s.card} accessibilityRole="none" accessibilityLabel={`Cost: $${totalCost.toFixed(2)}`}>
        <Text style={s.cardLabel}>Cost</Text>
        <Text style={s.cardValue}>${totalCost.toFixed(2)}</Text>
      </View>

      {/* Latency card */}
      {showLatency && (
        <View style={s.card} accessibilityRole="none" accessibilityLabel={
          latencyAvg != null && latencyP95 != null
            ? `Latency: average ${latencyAvg.toFixed(1)}s, p95 ${latencyP95.toFixed(1)}s`
            : 'Latency: no data'
        }>
          <Text style={s.cardLabel}>Latency</Text>
          <Text style={s.cardValue}>
            {latencyAvg != null && latencyP95 != null
              ? `avg ${latencyAvg.toFixed(1)}s / p95 ${latencyP95.toFixed(1)}s`
              : 'No data'}
          </Text>
        </View>
      )}

      {/* Error rate */}
      <View style={s.card} accessibilityRole="none" accessibilityLabel={`Error rate: ${errorRateProp}%`}>
        <Text style={s.cardLabel}>Error Rate</Text>
        <Text style={[s.cardValue, { color: COLOR_MAP[errColor] }]}>{errorRateProp.toFixed(1)}%</Text>
      </View>

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { gap: 12, padding: 12 },
  rootCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#ffffff' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  gaugeTrack: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 6 },
  gaugeFill: { height: 6, borderRadius: 3 },
  gaugePct: { fontSize: 11, color: '#6b7280', marginTop: 2 },
});

ExecutionMetricsPanel.displayName = 'ExecutionMetricsPanel';
export { ExecutionMetricsPanel };
export default ExecutionMetricsPanel;
