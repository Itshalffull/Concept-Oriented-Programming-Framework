/* ---------------------------------------------------------------------------
 * TimelockCountdown — Ink (terminal) implementation
 * Countdown timer for governance timelock periods
 * See widget spec: timelock-countdown.widget
 * ------------------------------------------------------------------------- */

export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'completed' | 'paused';
export type TimelockCountdownEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'EXPIRE' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'EXECUTE' }
  | { type: 'RESET' }
  | { type: 'EXECUTE_COMPLETE' }
  | { type: 'EXECUTE_ERROR' }
  | { type: 'RESUME' }
  | { type: 'CHALLENGE' };

export function timelockCountdownReducer(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState {
  switch (state) {
    case 'running':
      if (event.type === 'TICK') return 'running';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'EXPIRE') return 'expired';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'expired':
      if (event.type === 'EXECUTE') return 'executing';
      if (event.type === 'RESET') return 'running';
      return state;
    case 'executing':
      if (event.type === 'EXECUTE_COMPLETE') return 'completed';
      if (event.type === 'EXECUTE_ERROR') return 'expired';
      return state;
    case 'completed':
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'running';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function computeTimeRemaining(deadline: Date): TimeRemaining {
  const totalMs = Math.max(0, deadline.getTime() - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function formatRemaining(tr: TimeRemaining): string {
  if (tr.totalMs <= 0) return '0s';
  const parts: string[] = [];
  if (tr.days > 0) parts.push(`${tr.days}d`);
  if (tr.hours > 0) parts.push(`${tr.hours}h`);
  if (tr.minutes > 0) parts.push(`${tr.minutes}m`);
  parts.push(`${tr.seconds}s`);
  return parts.join(' ');
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TimelockCountdownProps {
  phase: string;
  deadline: string;
  elapsed: number;
  total: number;
  showChallenge?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  variant?: 'phase-based' | 'simple';
  onExecute?: () => void;
  onChallenge?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const BAR_WIDTH = 30;

export function TimelockCountdown({
  phase,
  deadline,
  elapsed,
  total,
  showChallenge = true,
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
  variant = 'phase-based',
  onExecute,
  onChallenge,
}: TimelockCountdownProps) {
  const [state, send] = useReducer(timelockCountdownReducer, 'running');
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    computeTimeRemaining(new Date(deadline)),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineDate = useMemo(() => new Date(deadline), [deadline]);

  const progress = useMemo(() => {
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, elapsed / total));
  }, [elapsed, total]);

  const countdownText = useMemo(() => formatRemaining(timeRemaining), [timeRemaining]);
  const progressPercent = Math.round(progress * 100);

  const displayPhase = useMemo(() => {
    switch (state) {
      case 'expired': return 'Ready to execute';
      case 'executing': return 'Executing...';
      case 'completed': return 'Execution complete';
      case 'paused': return `${phase} (paused)`;
      default: return phase;
    }
  }, [state, phase]);

  const stateColor = useMemo(() => {
    switch (state) {
      case 'running': return 'green';
      case 'warning': return 'yellow';
      case 'critical': return 'red';
      case 'expired': return 'magenta';
      case 'executing': return 'cyan';
      case 'completed': return 'green';
      case 'paused': return 'gray';
      default: return 'white';
    }
  }, [state]);

  // Countdown tick effect
  useEffect(() => {
    const tickingStates: TimelockCountdownState[] = ['running', 'warning', 'critical'];
    if (!tickingStates.includes(state)) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      const tr = computeTimeRemaining(deadlineDate);
      setTimeRemaining(tr);

      if (tr.totalMs <= 0) {
        send({ type: 'EXPIRE' });
        return;
      }

      const currentProgress = total > 0 ? Math.min(1, elapsed / total) : 0;
      if (state === 'running' && currentProgress >= warningThreshold) {
        send({ type: 'WARNING_THRESHOLD' });
      } else if (state === 'warning' && currentProgress >= criticalThreshold) {
        send({ type: 'CRITICAL_THRESHOLD' });
      } else {
        send({ type: 'TICK' });
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, deadlineDate, elapsed, total, warningThreshold, criticalThreshold]);

  // If deadline is already past on mount
  useEffect(() => {
    if (deadlineDate.getTime() <= Date.now() && state === 'running') {
      send({ type: 'EXPIRE' });
    }
  }, [deadlineDate, state]);

  // Build progress bar
  const progressBar = useMemo(() => {
    const filled = Math.round((progressPercent / 100) * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  }, [progressPercent]);

  useInput((input, key) => {
    if (key.return && state === 'expired') {
      send({ type: 'EXECUTE' });
      onExecute?.();
    } else if (input === 'c' && !key.ctrl && !key.meta) {
      const challengeDisabled = state === 'expired' || state === 'completed' || state === 'executing';
      if (!challengeDisabled) {
        onChallenge?.();
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Phase label */}
      <Box>
        <Text bold color={stateColor}>{displayPhase}</Text>
      </Box>

      {/* Countdown */}
      <Box>
        <Text color={stateColor} bold>
          {state === 'completed' ? '\u2713 Done' : `\u23F0 ${countdownText}`}
        </Text>
      </Box>

      {/* Progress bar */}
      <Box>
        <Text color={stateColor}>{progressBar}</Text>
        <Text dimColor> {progressPercent}%</Text>
      </Box>

      {/* Action hints */}
      <Box>
        {state === 'expired' && (
          <Text color="green">Enter to execute</Text>
        )}
        {state === 'executing' && (
          <Text color="cyan">Executing...</Text>
        )}
        {showChallenge && state !== 'expired' && state !== 'completed' && state !== 'executing' && (
          <Text dimColor>c to challenge</Text>
        )}
      </Box>
    </Box>
  );
}

export default TimelockCountdown;
