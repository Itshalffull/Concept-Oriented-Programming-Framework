export type TraceStepControlsState = 'paused' | 'playing';
export type TraceStepControlsEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FWD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_START' }
  | { type: 'JUMP_END' }
  | { type: 'PAUSE' }
  | { type: 'REACH_END' };

export function traceStepControlsReducer(state: TraceStepControlsState, event: TraceStepControlsEvent): TraceStepControlsState {
  switch (state) {
    case 'paused':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FWD') return 'paused';
      if (event.type === 'STEP_BACK') return 'paused';
      if (event.type === 'JUMP_START') return 'paused';
      if (event.type === 'JUMP_END') return 'paused';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'paused';
      if (event.type === 'REACH_END') return 'paused';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useReducer, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const SPEED_OPTIONS = [1, 2, 4] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

export interface TraceStepControlsProps {
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  speed?: number;
  showSpeed?: boolean;
  onStepForward?: () => void;
  onStepBack?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (step: number) => void;
  onFirst?: () => void;
  onLast?: () => void;
  onSpeedChange?: (speed: number) => void;
  children?: React.ReactNode;
}

const TraceStepControls = forwardRef<View, TraceStepControlsProps>(function TraceStepControls(
  { currentStep, totalSteps, playing, speed = 1, showSpeed = true, onStepForward, onStepBack, onPlay, onPause, onSeek, onFirst, onLast, onSpeedChange, children },
  ref,
) {
  const [state, send] = useReducer(traceStepControlsReducer, playing ? 'playing' : 'paused');
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const atFirst = currentStep <= 0;
  const atLast = currentStep >= totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  useEffect(() => {
    if (playing && state === 'paused') send({ type: 'PLAY' });
    else if (!playing && state === 'playing') send({ type: 'PAUSE' });
  }, [playing, state]);

  const startPlayback = useCallback(() => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    playIntervalRef.current = setInterval(() => { onStepForward?.(); }, 1000 / speed);
  }, [speed, onStepForward]);

  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current) { clearInterval(playIntervalRef.current); playIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (state === 'playing') startPlayback(); else stopPlayback();
    return stopPlayback;
  }, [state, startPlayback, stopPlayback]);

  useEffect(() => {
    if (state === 'playing' && atLast) { send({ type: 'REACH_END' }); onPause?.(); }
  }, [currentStep, atLast, state, onPause]);

  useEffect(() => { if (state === 'playing') startPlayback(); }, [speed, state, startPlayback]);

  const handlePlay = useCallback(() => { if (atLast) return; send({ type: 'PLAY' }); onPlay?.(); }, [atLast, onPlay]);
  const handlePause = useCallback(() => { send({ type: 'PAUSE' }); onPause?.(); }, [onPause]);
  const handleStepForward = useCallback(() => { if (atLast) return; send({ type: 'STEP_FWD' }); onStepForward?.(); }, [atLast, onStepForward]);
  const handleStepBack = useCallback(() => { if (atFirst) return; send({ type: 'STEP_BACK' }); onStepBack?.(); }, [atFirst, onStepBack]);
  const handleJumpStart = useCallback(() => { if (atFirst) return; send({ type: 'JUMP_START' }); onFirst?.(); }, [atFirst, onFirst]);
  const handleJumpEnd = useCallback(() => { if (atLast) return; send({ type: 'JUMP_END' }); onLast?.(); }, [atLast, onLast]);

  return (
    <View ref={ref} testID="trace-step-controls" accessibilityRole="toolbar" accessibilityLabel="Trace step controls" style={st.root}>
      <View style={st.transport}>
        <Pressable onPress={handleJumpStart} disabled={atFirst} accessibilityRole="button" accessibilityLabel="Jump to start" style={st.btn}>
          <Text style={[st.btnText, atFirst && st.disabled]}>{'\u25C4\u2502'}</Text>
        </Pressable>
        <Pressable onPress={handleStepBack} disabled={atFirst} accessibilityRole="button" accessibilityLabel="Step backward" style={st.btn}>
          <Text style={[st.btnText, atFirst && st.disabled]}>{'\u25C4'}</Text>
        </Pressable>
        <Pressable onPress={state === 'playing' ? handlePause : handlePlay} accessibilityRole="button"
          accessibilityLabel={state === 'playing' ? 'Pause' : 'Play'} style={st.btn}>
          <Text style={st.btnText}>{state === 'playing' ? '\u23F8' : '\u25B6'}</Text>
        </Pressable>
        <Pressable onPress={handleStepForward} disabled={atLast} accessibilityRole="button" accessibilityLabel="Step forward" style={st.btn}>
          <Text style={[st.btnText, atLast && st.disabled]}>{'\u25BA'}</Text>
        </Pressable>
        <Pressable onPress={handleJumpEnd} disabled={atLast} accessibilityRole="button" accessibilityLabel="Jump to end" style={st.btn}>
          <Text style={[st.btnText, atLast && st.disabled]}>{'\u2502\u25BA'}</Text>
        </Pressable>
      </View>

      <Text style={st.counter} accessibilityLiveRegion="polite" accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}`}>
        Step {currentStep + 1} of {totalSteps}
      </Text>

      <View style={st.progressBar} accessibilityRole="progressbar" accessibilityLabel="Trace progress"
        accessibilityValue={{ min: 1, max: totalSteps, now: currentStep + 1 }}>
        <View style={[st.progressFill, { width: `${progressPercent}%` as any }]} />
      </View>

      {showSpeed && (
        <View style={st.speedControl}>
          {SPEED_OPTIONS.map((s) => (
            <Pressable key={s} onPress={() => onSpeedChange?.(s)} accessibilityRole="button"
              accessibilityLabel={`Playback speed ${s}x`} accessibilityState={{ selected: s === speed }}
              style={[st.speedBtn, s === speed && st.speedBtnActive]}>
              <Text style={[st.speedBtnText, s === speed && st.speedBtnTextActive]}>{s}x</Text>
            </Pressable>
          ))}
        </View>
      )}
      {children}
    </View>
  );
});

const st = StyleSheet.create({
  root: { padding: 8 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  btn: { padding: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  btnText: { fontSize: 16 },
  disabled: { opacity: 0.3 },
  counter: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  progressBar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 3 },
  speedControl: { flexDirection: 'row', gap: 4 },
  speedBtn: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  speedBtnActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  speedBtnText: { fontSize: 12 },
  speedBtnTextActive: { fontWeight: '600' },
});

TraceStepControls.displayName = 'TraceStepControls';
export { TraceStepControls };
export default TraceStepControls;
