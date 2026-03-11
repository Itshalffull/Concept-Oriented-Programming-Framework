/* ---------------------------------------------------------------------------
 * TraceStepControls — Ink (terminal) implementation
 * Playback control toolbar for navigating trace steps
 * See widget spec: trace-step-controls.widget
 * ------------------------------------------------------------------------- */

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

import React, { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

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
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const BAR_WIDTH = 30;

export function TraceStepControls({
  currentStep,
  totalSteps,
  playing,
  speed = 1,
  showSpeed = true,
  onStepForward,
  onStepBack,
  onPlay,
  onPause,
  onSeek,
  onFirst,
  onLast,
  onSpeedChange,
}: TraceStepControlsProps) {
  const [state, send] = useReducer(traceStepControlsReducer, playing ? 'playing' : 'paused');
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const atFirst = currentStep <= 0;
  const atLast = currentStep >= totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  // Sync with external playing prop
  useEffect(() => {
    if (playing && state === 'paused') send({ type: 'PLAY' });
    else if (!playing && state === 'playing') send({ type: 'PAUSE' });
  }, [playing, state]);

  // Playback
  const startPlayback = useCallback(() => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    const intervalMs = 1000 / speed;
    playIntervalRef.current = setInterval(() => {
      onStepForward?.();
    }, intervalMs);
  }, [speed, onStepForward]);

  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state === 'playing') startPlayback();
    else stopPlayback();
    return stopPlayback;
  }, [state, startPlayback, stopPlayback]);

  // Auto-pause at end
  useEffect(() => {
    if (state === 'playing' && atLast) {
      send({ type: 'REACH_END' });
      onPause?.();
    }
  }, [currentStep, atLast, state, onPause]);

  // Progress bar
  const progressBar = useMemo(() => {
    const filled = Math.round((progressPercent / 100) * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  }, [progressPercent]);

  useInput((input, key) => {
    if (input === ' ') {
      if (state === 'playing') {
        send({ type: 'PAUSE' });
        onPause?.();
      } else {
        if (!atLast) {
          send({ type: 'PLAY' });
          onPlay?.();
        }
      }
    } else if (key.rightArrow) {
      if (!atLast) {
        send({ type: 'STEP_FWD' });
        onStepForward?.();
      }
    } else if (key.leftArrow) {
      if (!atFirst) {
        send({ type: 'STEP_BACK' });
        onStepBack?.();
      }
    } else if (input === 'h' || input === 'H') {
      if (!atFirst) {
        send({ type: 'JUMP_START' });
        onFirst?.();
      }
    } else if (input === 'e' || input === 'E') {
      if (!atLast) {
        send({ type: 'JUMP_END' });
        onLast?.();
      }
    } else if (input === 's' && showSpeed) {
      // Cycle speed
      const idx = SPEED_OPTIONS.indexOf(speed as PlaybackSpeed);
      const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
      onSpeedChange?.(next);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Transport controls */}
      <Box>
        <Text dimColor={atFirst}>\u25C4\u2502</Text>
        <Text> </Text>
        <Text dimColor={atFirst}>\u25C4</Text>
        <Text> </Text>
        <Text bold color="cyan">
          {state === 'playing' ? '\u23F8' : '\u25B6'}
        </Text>
        <Text> </Text>
        <Text dimColor={atLast}>\u25BA</Text>
        <Text> </Text>
        <Text dimColor={atLast}>\u2502\u25BA</Text>
        <Text>  </Text>
        <Text>Step {currentStep + 1} of {totalSteps}</Text>
      </Box>

      {/* Progress bar */}
      <Box>
        <Text color={state === 'playing' ? 'cyan' : 'white'}>{progressBar}</Text>
        <Text dimColor> {Math.round(progressPercent)}%</Text>
      </Box>

      {/* Speed indicator */}
      {showSpeed && (
        <Box>
          <Text dimColor>Speed: </Text>
          {SPEED_OPTIONS.map((s) => (
            <Text key={s} bold={s === speed} color={s === speed ? 'cyan' : undefined}>
              {s}x{' '}
            </Text>
          ))}
          <Text dimColor>(s to cycle)</Text>
        </Box>
      )}

      {/* Keyboard hints */}
      <Box>
        <Text dimColor>Space play/pause  \u2190\u2192 step  h home  e end</Text>
      </Box>
    </Box>
  );
}

export default TraceStepControls;
