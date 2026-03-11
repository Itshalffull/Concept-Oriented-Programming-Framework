export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent = | { type: 'HOVER_SEGMENT' } | { type: 'ANIMATE_IN' } | { type: 'ANIMATION_END' } | { type: 'UNHOVER' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle': if (event.type === 'HOVER_SEGMENT') return 'segmentHovered'; if (event.type === 'ANIMATE_IN') return 'animating'; return state;
    case 'animating': if (event.type === 'ANIMATION_END') return 'idle'; return state;
    case 'segmentHovered': if (event.type === 'UNHOVER') return 'idle'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface VoteSegment { label: string; count: number; color: string; }

export interface VoteResultBarProps {
  segments: VoteSegment[]; total: number; variant?: 'binary' | 'multi' | 'weighted';
  showLabels?: boolean; showQuorum?: boolean; quorumThreshold?: number; animate?: boolean; size?: 'sm' | 'md' | 'lg';
}

const VoteResultBar = forwardRef<View, VoteResultBarProps>(function VoteResultBar(
  { segments, total, variant = 'binary', showLabels = true, showQuorum = false, quorumThreshold, animate = false, size = 'md' }, ref,
) {
  const [state, send] = useReducer(voteResultBarReducer, 'idle');
  const barHeight = size === 'sm' ? 4 : size === 'lg' ? 12 : 8;

  useEffect(() => { if (animate) { send({ type: 'ANIMATE_IN' }); const t = setTimeout(() => send({ type: 'ANIMATION_END' }), 500); return () => clearTimeout(t); } }, [animate]);

  const computedSegments = useMemo(() => segments.map((seg) => ({ ...seg, pct: total > 0 ? (seg.count / total) * 100 : 0 })), [segments, total]);

  return (
    <View ref={ref} testID="vote-result-bar" accessibilityRole="none" accessibilityLabel={`Vote results: ${total} total votes`} style={st.root}>
      <View style={[st.bar, { height: barHeight, borderRadius: barHeight / 2 }]}>
        {computedSegments.map((seg, i) => (
          <Pressable key={i} onPressIn={() => send({ type: 'HOVER_SEGMENT' })} onPressOut={() => send({ type: 'UNHOVER' })}
            accessibilityRole="none" accessibilityLabel={`${seg.label}: ${seg.count} votes (${seg.pct.toFixed(1)}%)`}
            style={[st.segment, { width: `${seg.pct}%` as any, backgroundColor: seg.color }]} />
        ))}
        {showQuorum && quorumThreshold != null && total > 0 && (
          <View style={[st.quorumLine, { left: `${(quorumThreshold / total) * 100}%` as any }]} />
        )}
      </View>
      {showLabels && (
        <View style={st.labels}>
          {computedSegments.map((seg, i) => (
            <View key={i} style={st.labelRow}>
              <View style={[st.labelDot, { backgroundColor: seg.color }]} />
              <Text style={st.labelText}>{seg.label}: {seg.count} ({seg.pct.toFixed(1)}%)</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={st.total}>Total: {total}</Text>
    </View>);
});

const st = StyleSheet.create({
  root: { padding: 8 }, bar: { flexDirection: 'row', overflow: 'hidden', backgroundColor: '#e5e7eb', position: 'relative' },
  segment: { height: '100%' }, quorumLine: { position: 'absolute', top: -2, width: 2, height: '150%', backgroundColor: '#1f2937' },
  labels: { marginTop: 8, gap: 4 }, labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  labelDot: { width: 8, height: 8, borderRadius: 4 }, labelText: { fontSize: 12 }, total: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});

VoteResultBar.displayName = 'VoteResultBar';
export { VoteResultBar };
export default VoteResultBar;
