export type ExecutionOverlayState = 'idle' | 'live' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'replay';
export type ExecutionOverlayEvent =
  | { type: 'START' }
  | { type: 'LOAD_REPLAY' }
  | { type: 'STEP_ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'FAIL' }
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

import React, { useReducer, useEffect, useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

const STATE_DISPLAY: Record<string, { icon: string; color: string; label: string }> = {
  idle: { icon: '\u25CB', color: 'gray', label: 'Idle' },
  live: { icon: '\u25B6', color: 'green', label: 'Running' },
  suspended: { icon: '\u23F8', color: 'yellow', label: 'Suspended' },
  completed: { icon: '\u2713', color: 'green', label: 'Completed' },
  failed: { icon: '\u2717', color: 'red', label: 'Failed' },
  cancelled: { icon: '\u23F9', color: 'gray', label: 'Cancelled' },
  replay: { icon: '\u23EE', color: 'cyan', label: 'Replay' },
};

export interface ExecutionOverlayProps {
  status: string;
  activeStep?: string | undefined;
  startedAt?: string | undefined;
  endedAt?: string | undefined;
  mode?: 'live' | 'replay' | 'static';
  showControls?: boolean;
  showElapsed?: boolean;
  animateFlow?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onReset?: () => void;
  isFocused?: boolean;
}

export function ExecutionOverlay({
  status,
  activeStep,
  startedAt,
  endedAt,
  mode = 'live',
  showControls = true,
  showElapsed = true,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onReset,
  isFocused = false,
}: ExecutionOverlayProps) {
  const [state, send] = useReducer(executionOverlayReducer, 'idle');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const [animFrame, setAnimFrame] = useState(0);

  useEffect(() => {
    if (status === 'running' && state === 'idle') send({ type: 'START' });
    if (status === 'completed') send({ type: 'COMPLETE' });
    if (status === 'failed') send({ type: 'FAIL' });
    if (status === 'suspended') send({ type: 'SUSPEND' });
  }, [status]);

  useEffect(() => {
    if (state === 'live') {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
        setAnimFrame(prev => prev + 1);
      }, 1000);
      return () => clearInterval(intervalRef.current);
    }
  }, [state]);

  useInput((input, key) => {
    if (!isFocused || !showControls) return;
    if (input === 's' && state === 'idle') {
      send({ type: 'START' });
      onStart?.();
    }
    if (input === 'p' && state === 'live') {
      send({ type: 'SUSPEND' });
      onPause?.();
    }
    if (input === 'r' && state === 'suspended') {
      send({ type: 'RESUME' });
      onResume?.();
    }
    if (input === 'c' && (state === 'live' || state === 'suspended')) {
      send({ type: 'CANCEL' });
      onCancel?.();
    }
    if (input === 'r' && state === 'failed') {
      send({ type: 'RETRY' });
      onRetry?.();
    }
    if (input === 'x' && (state === 'completed' || state === 'failed' || state === 'cancelled')) {
      send({ type: 'RESET' });
      onReset?.();
      setElapsed(0);
    }
  });

  const display = STATE_DISPLAY[state] ?? STATE_DISPLAY.idle;
  const flowAnim = ['\u2500\u25B6', '\u2500\u2500\u25B6', '\u2500\u2500\u2500\u25B6'];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={display.color}>
      {/* Status bar */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={display.color}>{display.icon} </Text>
          <Text color={display.color} bold>{display.label}</Text>
          {state === 'live' && (
            <Text color="gray"> {flowAnim[animFrame % flowAnim.length]}</Text>
          )}
        </Box>
        {showElapsed && state !== 'idle' && (
          <Text color="gray">
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
          </Text>
        )}
      </Box>

      {/* Active step */}
      {activeStep && (state === 'live' || state === 'replay') && (
        <Box marginTop={1}>
          <Text color="yellow">{'\u25CF'} </Text>
          <Text>Active: </Text>
          <Text bold>{activeStep}</Text>
        </Box>
      )}

      {/* Time info */}
      {startedAt && (
        <Box>
          <Text color="gray">Started: {startedAt}</Text>
          {endedAt && <Text color="gray"> | Ended: {endedAt}</Text>}
        </Box>
      )}

      {/* Controls */}
      {isFocused && showControls && (
        <Box marginTop={1}>
          <Text color="gray">
            {state === 'idle' && '[s]tart'}
            {state === 'live' && '[p]ause [c]ancel'}
            {state === 'suspended' && '[r]esume [c]ancel'}
            {state === 'failed' && '[r]etry [x] Reset'}
            {(state === 'completed' || state === 'cancelled') && '[x] Reset'}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ExecutionOverlay;
