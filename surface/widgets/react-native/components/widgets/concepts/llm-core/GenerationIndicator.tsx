export type GenerationIndicatorState = 'idle' | 'generating' | 'complete' | 'error';
export type GenerationIndicatorEvent =
  | { type: 'START' }
  | { type: 'TOKEN' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function generationIndicatorReducer(state: GenerationIndicatorState, event: GenerationIndicatorEvent): GenerationIndicatorState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'generating';
      return state;
    case 'generating':
      if (event.type === 'TOKEN') return 'generating';
      if (event.type === 'COMPLETE') return 'complete';
      if (event.type === 'ERROR') return 'error';
      return state;
    case 'complete':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'START') return 'generating';
      return state;
    case 'error':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'generating';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

export interface GenerationIndicatorProps {
  status: GenerationIndicatorState;
  model?: string | undefined;
  tokenCount?: number | undefined;
  showTokens?: boolean;
  showModel?: boolean;
  showElapsed?: boolean;
  variant?: 'dots' | 'spinner' | 'bar';
  onRetry?: () => void;
  children?: ReactNode;
}

const GenerationIndicator = forwardRef<View, GenerationIndicatorProps>(function GenerationIndicator(
  { status, model, tokenCount, showTokens = true, showModel = true, showElapsed = true, variant = 'dots', onRetry, children },
  ref,
) {
  const [state, send] = useReducer(generationIndicatorReducer, 'idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    switch (status) {
      case 'generating':
        if (state === 'idle' || state === 'complete' || state === 'error') send({ type: state === 'error' ? 'RETRY' : 'START' });
        break;
      case 'complete':
        if (state === 'generating') send({ type: 'COMPLETE' });
        break;
      case 'error':
        if (state === 'generating') send({ type: 'ERROR' });
        break;
      case 'idle':
        if (state === 'complete' || state === 'error') send({ type: 'RESET' });
        break;
    }
  }, [status, state]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (state === 'generating') {
      setElapsedSeconds(0);
      intervalRef.current = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
      return () => { stopInterval(); };
    }
    if (state === 'complete' || state === 'error') { setFinalElapsed(elapsedSeconds); stopInterval(); }
    if (state === 'idle') { setElapsedSeconds(0); setFinalElapsed(0); stopInterval(); }
    return () => { stopInterval(); };
  }, [state, stopInterval]);

  const handleRetry = useCallback(() => { if (state === 'error') onRetry?.(); }, [state, onRetry]);

  const statusText = useMemo(() => {
    switch (state) { case 'generating': return 'Generating...'; case 'complete': return 'Complete'; case 'error': return 'Error'; default: return ''; }
  }, [state]);

  const elapsedText = useMemo(() => {
    if (state === 'generating') return formatElapsed(elapsedSeconds);
    if (state === 'complete' || state === 'error') return formatElapsed(finalElapsed);
    return '';
  }, [state, elapsedSeconds, finalElapsed]);

  const spinnerText = state === 'generating' ? (variant === 'dots' ? '...' : variant === 'spinner' ? '\u21BB' : '') : '';
  const isGenerating = state === 'generating';

  return (
    <View ref={ref} testID="generation-indicator" accessibilityRole="none" accessibilityLabel={`Generation ${state}`}
      accessibilityLiveRegion="polite" style={s.root}>
      {isGenerating && <Text style={s.spinner}>{spinnerText}</Text>}
      {variant === 'bar' && isGenerating && (
        <View style={s.barTrack}><View style={s.barFill} /></View>
      )}
      <Text style={[s.statusText, state === 'error' && s.errorText]}>{statusText}</Text>
      {showModel && model && <Text style={s.modelBadge}>{model}</Text>}
      {showTokens && tokenCount != null && <Text style={s.tokenCount}>{tokenCount} tokens</Text>}
      {showElapsed && (state === 'generating' || state === 'complete') && <Text style={s.elapsed}>{elapsedText}</Text>}
      {state === 'error' && onRetry && (
        <Pressable onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Retry generation" style={s.retryBtn}>
          <Text style={s.retryText}>Retry</Text>
        </Pressable>
      )}
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  spinner: { fontSize: 16 },
  barTrack: { width: 48, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { width: '50%', height: '100%', backgroundColor: '#6366f1', borderRadius: 3 },
  statusText: { fontSize: 13, color: '#6b7280' },
  errorText: { color: '#ef4444' },
  modelBadge: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, color: '#6b7280' },
  tokenCount: { fontSize: 11, color: '#9ca3af' },
  elapsed: { fontSize: 11, color: '#9ca3af' },
  retryBtn: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

GenerationIndicator.displayName = 'GenerationIndicator';
export { GenerationIndicator };
export default GenerationIndicator;
