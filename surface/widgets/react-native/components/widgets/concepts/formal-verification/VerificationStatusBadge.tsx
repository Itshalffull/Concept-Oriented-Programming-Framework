export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(state: VerificationStatusBadgeState, event: VerificationStatusBadgeEvent): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useRef, useReducer } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

const STATUS_ICONS: Record<VerificationStatus, string> = {
  proved: '\u2713', refuted: '\u2717', unknown: '?', timeout: '\u23F0', running: '\u21BB',
};

const STATUS_COLORS: Record<VerificationStatus, string> = {
  proved: '#22c55e', refuted: '#ef4444', unknown: '#6b7280', timeout: '#f97316', running: '#3b82f6',
};

export interface VerificationStatusBadgeProps {
  status?: VerificationStatus;
  label?: string;
  duration?: number | undefined;
  solver?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 12, md: 14, lg: 18 };

const VerificationStatusBadge = forwardRef<View, VerificationStatusBadgeProps>(function VerificationStatusBadge(
  { status = 'unknown', label = 'Unknown', duration, solver, size = 'md' },
  ref,
) {
  const [state, send] = useReducer(verificationStatusBadgeReducer, 'idle');
  const prevStatusRef = useRef(status);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
      send({ type: 'STATUS_CHANGE' });
    }
  }, [status]);

  useEffect(() => {
    if (state === 'animating') {
      animationTimerRef.current = setTimeout(() => send({ type: 'ANIMATION_END' }), 200);
      return () => clearTimeout(animationTimerRef.current);
    }
  }, [state]);

  const handlePressIn = useCallback(() => send({ type: 'HOVER' }), []);
  const handlePressOut = useCallback(() => send({ type: 'LEAVE' }), []);

  const hasTooltipContent = solver != null || duration != null;
  const tooltipText = [solver ?? null, duration != null ? `${duration}ms` : null].filter(Boolean).join(' \u2014 ');
  const fontSize = SIZE_MAP[size];

  return (
    <Pressable ref={ref} testID="verification-status-badge" onPressIn={handlePressIn} onPressOut={handlePressOut}
      accessibilityRole="text" accessibilityLiveRegion="polite"
      accessibilityLabel={`Verification status: ${label}`} style={st.root}>
      <Text style={[st.icon, { color: STATUS_COLORS[status], fontSize }]}>{STATUS_ICONS[status]}</Text>
      <Text style={[st.label, { fontSize }]}>{label}</Text>
      {state === 'hovered' && hasTooltipContent && (
        <View style={st.tooltip}>
          <Text style={st.tooltipText}>{tooltipText}</Text>
        </View>
      )}
    </Pressable>
  );
});

const st = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  icon: { fontWeight: '700' },
  label: {},
  tooltip: { position: 'absolute', top: -28, left: 0, backgroundColor: '#1f2937', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tooltipText: { color: '#f9fafb', fontSize: 12 },
});

VerificationStatusBadge.displayName = 'VerificationStatusBadge';
export { VerificationStatusBadge };
export default VerificationStatusBadge;
