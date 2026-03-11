/* ---------------------------------------------------------------------------
 * SlaTimer — Five-state countdown timer for SLA tracking
 *
 * Displays remaining time with color-coded urgency phases: on-track (green),
 * warning (yellow), critical (orange), breached (red), and paused (gray).
 * Shows a progress bar, phase label, and elapsed time.
 * ------------------------------------------------------------------------- */

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

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface SlaTimerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Due date as ISO 8601 string */
  dueAt: string;
  /** Current status label */
  status: string;
  /** Fraction of total time at which warning phase begins (0-1) */
  warningThreshold?: number;
  /** Fraction of total time at which critical phase begins (0-1) */
  criticalThreshold?: number;
  /** Whether to show elapsed time since start */
  showElapsed?: boolean;
  /** ISO datetime when the SLA clock started */
  startedAt?: string;
  /** Called when SLA is breached */
  onBreach?: () => void;
  /** Called when warning threshold is reached */
  onWarning?: () => void;
  /** Called when critical threshold is reached */
  onCritical?: () => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const SlaTimer = forwardRef<HTMLDivElement, SlaTimerProps>(function SlaTimer(
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
    ...rest
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

  // Tick effect
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

      // Check thresholds and transition states
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

  const handlePause = useCallback(() => {
    send({ type: 'PAUSE' });
  }, []);

  const handleResume = useCallback(() => {
    send({ type: 'RESUME' });
  }, []);

  const progressPercent = Math.round(progress * 100);

  return (
    <div
      ref={ref}
      role="timer"
      aria-label={`SLA timer: ${PHASE_LABELS[state]}`}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="sla-timer"
      data-part="root"
      data-state={state}
      tabIndex={0}
      {...rest}
    >
      {/* Countdown display */}
      <span
        data-part="countdown"
        aria-label={`Time remaining: ${formatCountdown(remaining)}`}
      >
        {state === 'breached' ? 'BREACHED' : formatCountdown(remaining)}
      </span>

      {/* Phase label */}
      <span data-part="phase" role="status" data-phase={state}>
        {PHASE_LABELS[state]}
      </span>

      {/* Progress bar */}
      <div
        data-part="progress"
        data-phase={state}
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`SLA progress: ${progressPercent}%`}
      >
        <div
          data-part="progress-fill"
          data-phase={state}
          style={{ width: `${progressPercent}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Elapsed time */}
      {showElapsed && (
        <span
          data-part="elapsed"
          data-visible="true"
          aria-label={`Elapsed time: ${formatElapsed(elapsed)}`}
        >
          Elapsed: {formatElapsed(elapsed)}
        </span>
      )}

      {/* Pause/Resume control */}
      {state !== 'breached' && (
        <button
          type="button"
          data-part="pause-resume"
          onClick={state === 'paused' ? handleResume : handlePause}
          aria-label={state === 'paused' ? 'Resume timer' : 'Pause timer'}
        >
          {state === 'paused' ? 'Resume' : 'Pause'}
        </button>
      )}

      {children}
    </div>
  );
});

SlaTimer.displayName = 'SlaTimer';
export { SlaTimer };
export default SlaTimer;
