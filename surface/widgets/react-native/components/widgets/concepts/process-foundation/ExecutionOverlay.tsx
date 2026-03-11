export type ExecutionOverlayState = 'idle' | 'live' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'replay';
export type ExecutionOverlayEvent =
  | { type: 'START' }
  | { type: 'LOAD_REPLAY' }
  | { type: 'STEP_ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'FAIL'; error?: string }
  | { type: 'SUSPEND' }
  | { type: 'CANCEL' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'RETRY' }
  | { type: 'REPLAY_STEP' }
  | { type: 'REPLAY_END' };

export function executionOverlayReducer(state: ExecutionOverlayState, event: ExecutionOverlayEvent): ExecutionOverlayState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'live';
      if (event.type === 'LOAD_REPLAY') return 'replay';
      return state;
    case 'live':
      if (event.type === 'STEP_ADVANCE') return 'live';
      if (event.type === 'COMPLETE') return 'completed';
      if (event.type === 'FAIL') return 'failed';
      if (event.type === 'SUSPEND') return 'suspended';
      if (event.type === 'CANCEL') return 'cancelled';
      return state;
    case 'suspended':
      if (event.type === 'RESUME') return 'live';
      if (event.type === 'CANCEL') return 'cancelled';
      return state;
    case 'completed':
      if (event.type === 'RESET') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'live';
      return state;
    case 'cancelled':
      if (event.type === 'RESET') return 'idle';
      return state;
    case 'replay':
      if (event.type === 'REPLAY_STEP') return 'replay';
      if (event.type === 'REPLAY_END') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'active' | 'complete' | 'pending' | 'failed' | 'skipped';
}

export interface ExecutionOverlayProps {
  status: string;
  activeStep?: string | undefined;
  startedAt?: string | undefined;
  endedAt?: string | undefined;
  mode?: 'live' | 'replay' | 'static';
  showControls?: boolean;
  showElapsed?: boolean;
  animateFlow?: boolean;
  steps?: ExecutionStep[];
  errorMessage?: string;
  onSuspend?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  children?: ReactNode;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function statusIcon(status: ExecutionStep['status']): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'active': return '\u25CF';
    case 'failed': return '\u2717';
    case 'skipped': return '\u2014';
    case 'pending':
    default: return '\u25CB';
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: '#3b82f6',
  complete: '#22c55e',
  failed: '#dc2626',
  skipped: '#9ca3af',
  pending: '#d1d5db',
};

const ExecutionOverlay = forwardRef<View, ExecutionOverlayProps>(function ExecutionOverlay(
  {
    status,
    activeStep,
    startedAt,
    endedAt,
    mode = 'live',
    showControls = true,
    showElapsed = true,
    animateFlow = true,
    steps = [],
    errorMessage,
    onSuspend,
    onResume,
    onCancel,
    onRetry,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(executionOverlayReducer, 'idle');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode === 'replay' && state === 'idle') send({ type: 'LOAD_REPLAY' });
  }, [mode, state]);

  useEffect(() => {
    if (status === 'running' && state === 'idle') send({ type: 'START' });
    else if (status === 'completed' && state === 'live') send({ type: 'COMPLETE' });
    else if (status === 'failed' && state === 'live') send({ type: 'FAIL' });
    else if (status === 'suspended' && state === 'live') send({ type: 'SUSPEND' });
    else if (status === 'cancelled' && (state === 'live' || state === 'suspended')) send({ type: 'CANCEL' });
  }, [status, state]);

  useEffect(() => {
    if (state === 'live' && startedAt) {
      const start = new Date(startedAt).getTime();
      const tick = () => setElapsed(Date.now() - start);
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    if (state !== 'live' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if ((state === 'completed' || state === 'failed' || state === 'cancelled') && startedAt) {
      const start = new Date(startedAt).getTime();
      const end = endedAt ? new Date(endedAt).getTime() : Date.now();
      setElapsed(end - start);
    }
  }, [state, startedAt, endedAt]);

  const handleSuspend = useCallback(() => { send({ type: 'SUSPEND' }); onSuspend?.(); }, [onSuspend]);
  const handleResume = useCallback(() => { send({ type: 'RESUME' }); onResume?.(); }, [onResume]);
  const handleCancel = useCallback(() => { send({ type: 'CANCEL' }); onCancel?.(); }, [onCancel]);
  const handleRetry = useCallback(() => { send({ type: 'RETRY' }); onRetry?.(); }, [onRetry]);

  return (
    <View ref={ref} testID="execution-overlay" accessibilityRole="none" accessibilityLabel={`Process execution: ${status}`} accessibilityState={{ busy: state === 'live' }} style={s.root}>
      {/* Step overlays */}
      {steps.map((step) => (
        <View key={step.id} style={s.stepOverlay}>
          <Text style={[s.stepIcon, { color: STATUS_COLORS[step.status] ?? '#9ca3af' }]}>{statusIcon(step.status)}</Text>
          <Text style={s.stepLabel}>{step.label}</Text>
        </View>
      ))}

      {/* Active step marker */}
      {activeStep && (
        <View style={s.activeMarker}>
          <Text style={s.pulseIndicator} accessibilityLabel={`Active step: ${activeStep}`}>{'\u25CF'}</Text>
          <Text style={s.activeStepText}>{activeStep}</Text>
        </View>
      )}

      {/* Status bar */}
      <View style={s.statusBar}>
        <Text style={s.statusLabel}>{status}</Text>
        {showElapsed && (
          <Text style={s.elapsedText} accessibilityLabel={`Elapsed time: ${formatElapsed(elapsed)}`}>
            {formatElapsed(elapsed)}
          </Text>
        )}
      </View>

      {/* Controls */}
      {showControls && (
        <View style={s.controls} accessibilityRole="toolbar" accessibilityLabel="Execution controls">
          {state === 'live' && (
            <Pressable onPress={handleSuspend} accessibilityRole="button" accessibilityLabel="Suspend execution" style={s.controlButton}>
              <Text style={s.controlButtonText}>Suspend</Text>
            </Pressable>
          )}
          {state === 'suspended' && (
            <Pressable onPress={handleResume} accessibilityRole="button" accessibilityLabel="Resume execution" style={s.controlButton}>
              <Text style={s.controlButtonText}>Resume</Text>
            </Pressable>
          )}
          {(state === 'live' || state === 'suspended') && (
            <Pressable onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel execution" style={[s.controlButton, s.cancelButton]}>
              <Text style={[s.controlButtonText, s.cancelButtonText]}>Cancel</Text>
            </Pressable>
          )}
          {state === 'failed' && (
            <Pressable onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Retry execution" style={s.controlButton}>
              <Text style={s.controlButtonText}>Retry</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Error banner */}
      {state === 'failed' && (
        <View style={s.errorBanner} accessibilityRole="alert">
          <Text style={s.errorText}>{errorMessage ?? 'Execution failed'}</Text>
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  stepOverlay: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  stepIcon: { fontSize: 14, width: 18, textAlign: 'center' },
  stepLabel: { fontSize: 13 },
  activeMarker: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 6 },
  pulseIndicator: { color: '#3b82f6', fontSize: 10 },
  activeStepText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 },
  statusLabel: { fontSize: 14, fontWeight: '700' },
  elapsedText: { fontSize: 13, color: '#6b7280' },
  controls: { flexDirection: 'row', gap: 8, marginTop: 8 },
  controlButton: { backgroundColor: '#3b82f6', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  controlButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cancelButton: { backgroundColor: '#dc2626' },
  cancelButtonText: { color: '#fff' },
  errorBanner: { backgroundColor: '#fef2f2', padding: 10, borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
});

ExecutionOverlay.displayName = 'ExecutionOverlay';
export { ExecutionOverlay };
export default ExecutionOverlay;
