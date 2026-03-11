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

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/** Decomposed time remaining */
interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

/**
 * Compute the time remaining from now until `deadline`.
 * Returns zero-clamped values (never negative).
 */
function computeTimeRemaining(deadline: Date): TimeRemaining {
  const totalMs = Math.max(0, deadline.getTime() - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs };
}

/** Format remaining time as a human-readable string */
function formatRemaining(tr: TimeRemaining): string {
  if (tr.totalMs <= 0) return '0s';
  const parts: string[] = [];
  if (tr.days > 0) parts.push(`${tr.days}d`);
  if (tr.hours > 0) parts.push(`${tr.hours}h`);
  if (tr.minutes > 0) parts.push(`${tr.minutes}m`);
  parts.push(`${tr.seconds}s`);
  return parts.join(' ');
}

export interface TimelockCountdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current governance phase label (e.g., "Timelock delay") */
  phase: string;
  /** ISO 8601 deadline timestamp for the timelock expiration */
  deadline: string;
  /** Elapsed time in the timelock period (seconds or arbitrary units matching `total`) */
  elapsed: number;
  /** Total duration of the timelock period (same units as `elapsed`) */
  total: number;
  /** Whether to show the challenge button (default: true) */
  showChallenge?: boolean;
  /** Progress fraction (0-1) at which warning state activates (default: 0.8) */
  warningThreshold?: number;
  /** Progress fraction (0-1) at which critical state activates (default: 0.95) */
  criticalThreshold?: number;
  /** Display variant */
  variant?: 'phase-based' | 'simple';
  /** Callback fired when the execute action is triggered */
  onExecute?: () => void;
  /** Callback fired when the challenge action is triggered */
  onChallenge?: () => void;
  children?: ReactNode;
}

const TimelockCountdown = forwardRef<HTMLDivElement, TimelockCountdownProps>(function TimelockCountdown(
  {
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
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(timelockCountdownReducer, 'running');
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    computeTimeRemaining(new Date(deadline)),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deadlineDate = useMemo(() => new Date(deadline), [deadline]);

  /** Progress ratio: elapsed / total, clamped to [0, 1] */
  const progress = useMemo(() => {
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, elapsed / total));
  }, [elapsed, total]);

  /** Formatted countdown text */
  const countdownText = useMemo(() => formatRemaining(timeRemaining), [timeRemaining]);

  /** Formatted absolute target date */
  const formattedDeadline = useMemo(() => {
    try {
      return deadlineDate.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return deadline;
    }
  }, [deadlineDate, deadline]);

  /** Phase label that adapts to widget state */
  const displayPhase = useMemo(() => {
    switch (state) {
      case 'expired':
        return 'Ready to execute';
      case 'executing':
        return 'Executing...';
      case 'completed':
        return 'Execution complete';
      case 'paused':
        return `${phase} (paused)`;
      default:
        return phase;
    }
  }, [state, phase]);

  // Clear interval helper
  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Countdown tick effect
  useEffect(() => {
    // Only tick in active countdown states
    const tickingStates: TimelockCountdownState[] = ['running', 'warning', 'critical'];
    if (!tickingStates.includes(state)) {
      stopInterval();
      return;
    }

    const tick = () => {
      const tr = computeTimeRemaining(deadlineDate);
      setTimeRemaining(tr);

      if (tr.totalMs <= 0) {
        send({ type: 'EXPIRE' });
        return;
      }

      // Check threshold transitions based on progress ratio
      const currentProgress = total > 0 ? Math.min(1, elapsed / total) : 0;
      if (state === 'running' && currentProgress >= warningThreshold) {
        send({ type: 'WARNING_THRESHOLD' });
      } else if (state === 'warning' && currentProgress >= criticalThreshold) {
        send({ type: 'CRITICAL_THRESHOLD' });
      } else {
        send({ type: 'TICK' });
      }
    };

    // Immediate tick
    tick();

    intervalRef.current = setInterval(tick, 1000);

    return () => {
      stopInterval();
    };
  }, [state, deadlineDate, elapsed, total, warningThreshold, criticalThreshold, stopInterval]);

  // If deadline is already past on mount, immediately expire
  useEffect(() => {
    if (deadlineDate.getTime() <= Date.now() && state === 'running') {
      send({ type: 'EXPIRE' });
    }
  }, [deadlineDate, state]);

  const handleExecute = useCallback(() => {
    if (state === 'expired') {
      send({ type: 'EXECUTE' });
      onExecute?.();
    }
  }, [state, onExecute]);

  const handleChallenge = useCallback(() => {
    const challengeDisabledStates: TimelockCountdownState[] = ['expired', 'completed', 'executing'];
    if (!challengeDisabledStates.includes(state)) {
      onChallenge?.();
    }
  }, [state, onChallenge]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
      if (e.key === 'c') {
        // Only trigger on bare 'c' press, not when used with modifiers
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleChallenge();
        }
      }
    },
    [handleExecute, handleChallenge],
  );

  const executeDisabled = state !== 'expired';
  const challengeDisabled = state === 'expired' || state === 'completed' || state === 'executing';

  /** ARIA label reflects phase and remaining time */
  const ariaLabel = `${displayPhase}: ${countdownText}`;

  /** Progress bar percentage for inline style */
  const progressPercent = Math.round(progress * 100);

  return (
    <div
      ref={ref}
      role="timer"
      aria-label={ariaLabel}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="timelock-countdown"
      data-part="root"
      data-state={state}
      data-variant={variant}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...restProps}
    >
      {/* Phase label */}
      <span data-part="phase-label" data-state={state}>
        {displayPhase}
      </span>

      {/* Live countdown text */}
      <span
        data-part="countdown-text"
        data-state={state}
        data-urgency={state}
        aria-atomic="true"
      >
        {state === 'completed' ? 'Done' : countdownText}
      </span>

      {/* Absolute target date */}
      <span data-part="target-date" data-state={state}>
        {formattedDeadline}
      </span>

      {/* Progress bar */}
      <div
        data-part="progress-bar"
        data-state={state}
        data-progress={progress}
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Timelock progress: ${progressPercent}%`}
      >
        <div
          data-part="progress-fill"
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Execute button - enabled only when expired */}
      <button
        type="button"
        data-part="execute-button"
        data-state={state}
        aria-label="Execute proposal"
        aria-disabled={executeDisabled}
        disabled={executeDisabled}
        tabIndex={0}
        onClick={handleExecute}
      >
        {state === 'executing' ? 'Executing...' : 'Execute'}
      </button>

      {/* Challenge button - visible based on showChallenge prop */}
      {showChallenge && (
        <button
          type="button"
          data-part="challenge-button"
          data-state={state}
          data-visible="true"
          aria-label="Challenge execution"
          aria-disabled={challengeDisabled}
          disabled={challengeDisabled}
          tabIndex={0}
          onClick={handleChallenge}
        >
          Challenge
        </button>
      )}

      {children}
    </div>
  );
});

TimelockCountdown.displayName = 'TimelockCountdown';
export { TimelockCountdown };
export default TimelockCountdown;
