export type SlaTimerState = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';
export type SlaTimerEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'BREACH' }
  | { type: 'RESUME' };

export function slaTimerReducer(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState {
  switch (state) {
    case 'onTrack':
      if (event.type === 'TICK') return 'onTrack';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'BREACH') return 'breached';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'breached':
      if (event.type === 'TICK') return 'breached';
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'onTrack';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface SlaTimerProps {
  dueAt: string;
  status: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  showElapsed?: boolean;
  startedAt?: string;
  onBreach?: () => void;
  onWarning?: () => void;
  onCritical?: () => void;
  children?: ReactNode;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const PHASE_LABELS: Record<SlaTimerState, string> = {
  onTrack: 'On Track',
  warning: 'Warning',
  critical: 'Critical',
  breached: 'Breached',
  paused: 'Paused',
};

const PHASE_COLORS: Record<SlaTimerState, string> = {
  onTrack: '#22c55e',
  warning: '#f59e0b',
  critical: '#ea580c',
  breached: '#dc2626',
  paused: '#9ca3af',
};

const SlaTimer = forwardRef<View, SlaTimerProps>(function SlaTimer(
  {
    dueAt,
    status,
    warningThreshold = 0.7,
    criticalThreshold = 0.9,
    showElapsed = true,
    startedAt,
    onBreach,
    onWarning,
    onCritical,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(slaTimerReducer, 'onTrack');
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breachedRef = useRef(false);
  const warningRef = useRef(false);
  const criticalRef = useRef(false);

  const dueTime = new Date(dueAt).getTime();
  const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
  const totalDuration = dueTime - startTime;

  useEffect(() => {
    if (state === 'paused') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, dueTime - now);
      const elap = now - startTime;
      const prog = totalDuration > 0 ? Math.min(1, elap / totalDuration) : 1;

      setRemaining(rem);
      setElapsed(elap);
      setProgress(prog);

      send({ type: 'TICK' });

      if (rem <= 0 && !breachedRef.current) {
        breachedRef.current = true;
        send({ type: 'BREACH' });
        onBreach?.();
      } else if (prog >= criticalThreshold && !criticalRef.current && rem > 0) {
        criticalRef.current = true;
        send({ type: 'CRITICAL_THRESHOLD' });
        onCritical?.();
      } else if (prog >= warningThreshold && !warningRef.current && rem > 0) {
        warningRef.current = true;
        send({ type: 'WARNING_THRESHOLD' });
        onWarning?.();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, dueTime, startTime, totalDuration, warningThreshold, criticalThreshold, onBreach, onWarning, onCritical]);

  const handlePause = useCallback(() => { send({ type: 'PAUSE' }); }, []);
  const handleResume = useCallback(() => { send({ type: 'RESUME' }); }, []);

  const progressPercent = Math.round(progress * 100);
  const phaseColor = PHASE_COLORS[state];

  return (
    <View ref={ref} testID="sla-timer" accessibilityRole="timer" accessibilityLabel={`SLA timer: ${PHASE_LABELS[state]}`} style={s.root}>
      {/* Countdown */}
      <Text style={[s.countdown, { color: phaseColor }]} accessibilityLabel={`Time remaining: ${formatCountdown(remaining)}`}>
        {state === 'breached' ? 'BREACHED' : formatCountdown(remaining)}
      </Text>

      {/* Phase label */}
      <View style={[s.phaseBadge, { backgroundColor: phaseColor }]}>
        <Text style={s.phaseText}>{PHASE_LABELS[state]}</Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progressPercent }} accessibilityLabel={`SLA progress: ${progressPercent}%`}>
        <View style={[s.progressFill, { width: `${progressPercent}%` as any, backgroundColor: phaseColor }]} />
      </View>

      {/* Elapsed */}
      {showElapsed && (
        <Text style={s.elapsedText} accessibilityLabel={`Elapsed time: ${formatElapsed(elapsed)}`}>
          Elapsed: {formatElapsed(elapsed)}
        </Text>
      )}

      {/* Pause/Resume */}
      {state !== 'breached' && (
        <Pressable
          onPress={state === 'paused' ? handleResume : handlePause}
          accessibilityRole="button"
          accessibilityLabel={state === 'paused' ? 'Resume timer' : 'Pause timer'}
          style={s.pauseButton}
        >
          <Text style={s.pauseButtonText}>{state === 'paused' ? 'Resume' : 'Pause'}</Text>
        </Pressable>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 16, alignItems: 'center' },
  countdown: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 6 },
  phaseBadge: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12, marginBottom: 12 },
  phaseText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  elapsedText: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  pauseButton: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  pauseButtonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
});

SlaTimer.displayName = 'SlaTimer';
export { SlaTimer };
export default SlaTimer;
