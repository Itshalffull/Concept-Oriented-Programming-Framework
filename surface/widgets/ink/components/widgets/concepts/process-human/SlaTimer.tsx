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

import React, { useReducer, useEffect, useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SlaTimerProps {
  dueAt: string;
  status: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  showElapsed?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  isFocused?: boolean;
}

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';
  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  if (hours > 0) return `${sign}${hours}h ${minutes}m`;
  if (minutes > 0) return `${sign}${minutes}m ${seconds}s`;
  return `${sign}${seconds}s`;
}

export function SlaTimer({
  dueAt,
  status,
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  showElapsed = false,
  onPause,
  onResume,
  isFocused = false,
}: SlaTimerProps) {
  const [state, send] = useReducer(slaTimerReducer, 'onTrack');
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef(Date.now());

  const dueTime = new Date(dueAt).getTime();
  const totalDuration = dueTime - startRef.current;
  const remaining = dueTime - now;
  const elapsed = now - startRef.current;
  const progress = totalDuration > 0 ? elapsed / totalDuration : 0;

  useEffect(() => {
    if (state !== 'paused') {
      intervalRef.current = setInterval(() => {
        setNow(Date.now());
        send({ type: 'TICK' });
      }, 1000);
      return () => clearInterval(intervalRef.current);
    }
  }, [state]);

  useEffect(() => {
    if (remaining <= 0 && state !== 'breached' && state !== 'paused') {
      send({ type: 'BREACH' });
    } else if (progress >= criticalThreshold && state === 'warning') {
      send({ type: 'CRITICAL_THRESHOLD' });
    } else if (progress >= warningThreshold && state === 'onTrack') {
      send({ type: 'WARNING_THRESHOLD' });
    }
  }, [now, progress, remaining]);

  useInput((input) => {
    if (!isFocused) return;
    if (input === 'p' && state !== 'breached' && state !== 'paused') {
      send({ type: 'PAUSE' });
      onPause?.();
    }
    if (input === 'r' && state === 'paused') {
      send({ type: 'RESUME' });
      onResume?.();
    }
  });

  const STATE_COLORS: Record<string, string> = {
    onTrack: 'green',
    warning: 'yellow',
    critical: 'red',
    breached: 'red',
    paused: 'gray',
  };

  const STATE_LABELS: Record<string, string> = {
    onTrack: 'On Track',
    warning: 'Warning',
    critical: 'Critical',
    breached: 'BREACHED',
    paused: 'Paused',
  };

  const color = STATE_COLORS[state] ?? 'white';
  const label = STATE_LABELS[state] ?? state;
  const barWidth = 20;
  const filled = Math.min(barWidth, Math.round(progress * barWidth));
  const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={color}>
      <Box justifyContent="space-between">
        <Box>
          <Text color={color} bold>{state === 'breached' ? '\u26A0' : '\u23F1'} </Text>
          <Text color={color} bold>{label}</Text>
        </Box>
        <Text color={color} bold>
          {remaining > 0 ? formatDuration(remaining) : formatDuration(remaining) + ' overdue'}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={color}>{progressBar}</Text>
        <Text color="gray"> {Math.round(progress * 100)}%</Text>
      </Box>

      {showElapsed && (
        <Box>
          <Text color="gray">Elapsed: {formatDuration(elapsed)}</Text>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            {state === 'paused' ? '[r]esume' : state !== 'breached' ? '[p]ause' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default SlaTimer;
