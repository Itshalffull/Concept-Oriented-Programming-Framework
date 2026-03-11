export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'paused';
export type TimelockCountdownEvent = | { type: 'TICK' } | { type: 'WARNING_THRESHOLD' } | { type: 'EXPIRE' } | { type: 'PAUSE' } | { type: 'CRITICAL_THRESHOLD' } | { type: 'EXECUTE' } | { type: 'RESET' } | { type: 'EXECUTE_COMPLETE' } | { type: 'EXECUTE_ERROR' } | { type: 'RESUME' };

export function timelockCountdownReducer(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState {
  switch (state) {
    case 'running': if (event.type === 'TICK') return 'running'; if (event.type === 'WARNING_THRESHOLD') return 'warning'; if (event.type === 'EXPIRE') return 'expired'; if (event.type === 'PAUSE') return 'paused'; return state;
    case 'warning': if (event.type === 'TICK') return 'warning'; if (event.type === 'CRITICAL_THRESHOLD') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'critical': if (event.type === 'TICK') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'expired': if (event.type === 'EXECUTE') return 'executing'; if (event.type === 'RESET') return 'running'; return state;
    case 'executing': if (event.type === 'EXECUTE_COMPLETE') return 'expired'; if (event.type === 'EXECUTE_ERROR') return 'expired'; return state;
    case 'paused': if (event.type === 'RESUME') return 'running'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface TimelockCountdownProps {
  phase?: string; deadline: string; elapsed?: number; total?: number; showChallenge?: boolean;
  warningThreshold?: number; criticalThreshold?: number; variant?: 'phase-based' | 'simple';
  onExecute?: () => void; onPause?: () => void; onResume?: () => void;
}

const STATE_COLORS: Record<string, string> = { running: '#3b82f6', warning: '#eab308', critical: '#ef4444', expired: '#6b7280', executing: '#8b5cf6', paused: '#9ca3af' };

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00:00';
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TimelockCountdown = forwardRef<View, TimelockCountdownProps>(function TimelockCountdown(
  { phase = 'Timelock delay', deadline, elapsed = 0, total = 100, warningThreshold = 0.75, criticalThreshold = 0.9, onExecute, onPause, onResume }, ref,
) {
  const [state, send] = useReducer(timelockCountdownReducer, 'running');
  const [remaining, setRemaining] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const update = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
      if (ms <= 0) send({ type: 'EXPIRE' });
    };
    update();
    timerRef.current = setInterval(() => { if (state !== 'paused' && state !== 'expired' && state !== 'executing') { send({ type: 'TICK' }); update(); } }, 1000);
    return () => clearInterval(timerRef.current);
  }, [deadline, state]);

  const progress = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;

  return (
    <View ref={ref} testID="timelock-countdown" accessibilityRole="timer" accessibilityLabel={`Timelock countdown: ${phase}`}
      accessibilityLiveRegion="polite" style={s.root}>
      <Text style={s.phase}>{phase}</Text>
      <Text style={[s.remaining, { color: STATE_COLORS[state] }]}>{formatRemaining(remaining)}</Text>
      <Text style={s.deadline}>Deadline: {new Date(deadline).toLocaleString()}</Text>
      <View style={s.bar}><View style={[s.fill, { width: `${progress}%` as any, backgroundColor: STATE_COLORS[state] }]} /></View>
      <View style={s.actions}>
        {state === 'expired' && onExecute && <Pressable onPress={() => { send({ type: 'EXECUTE' }); onExecute(); }} accessibilityRole="button" style={[s.btn, { backgroundColor: '#8b5cf6' }]}><Text style={s.btnText}>Execute</Text></Pressable>}
        {state === 'running' && onPause && <Pressable onPress={() => { send({ type: 'PAUSE' }); onPause(); }} accessibilityRole="button" style={s.btn}><Text style={s.btnText}>Pause</Text></Pressable>}
        {state === 'paused' && onResume && <Pressable onPress={() => { send({ type: 'RESUME' }); onResume(); }} accessibilityRole="button" style={s.btn}><Text style={s.btnText}>Resume</Text></Pressable>}
      </View>
    </View>);
});

const s = StyleSheet.create({
  root: { padding: 12 }, phase: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  remaining: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  deadline: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  bar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

TimelockCountdown.displayName = 'TimelockCountdown';
export { TimelockCountdown };
export default TimelockCountdown;
