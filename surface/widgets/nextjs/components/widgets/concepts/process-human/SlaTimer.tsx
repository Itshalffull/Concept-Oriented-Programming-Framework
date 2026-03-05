/* ---------------------------------------------------------------------------
 * SlaTimer — Server Component
 *
 * Five-state countdown timer for SLA tracking. Displays remaining time
 * with color-coded urgency phases: on-track, warning, critical, breached,
 * paused. Shows progress bar, phase label, and elapsed time.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type SlaPhase = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';

export interface SlaTimerProps {
  /** Due date as ISO 8601 string. */
  dueAt: string;
  /** Current status label. */
  status: string;
  /** Fraction of total time at which warning phase begins (0-1). */
  warningThreshold?: number;
  /** Fraction of total time at which critical phase begins (0-1). */
  criticalThreshold?: number;
  /** Whether to show elapsed time since start. */
  showElapsed?: boolean;
  /** ISO datetime when the SLA clock started. */
  startedAt?: string;
  /** Server-computed phase. */
  phase?: SlaPhase;
  /** Server-computed remaining time string. */
  remainingText?: string;
  /** Server-computed elapsed time string. */
  elapsedText?: string;
  /** Server-computed progress percentage (0-100). */
  progressPercent?: number;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const PHASE_LABELS: Record<SlaPhase, string> = {
  onTrack: 'On Track',
  warning: 'Warning',
  critical: 'Critical',
  breached: 'Breached',
  paused: 'Paused',
};

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function SlaTimer({
  dueAt: _dueAt,
  status: _status,
  showElapsed = true,
  phase = 'onTrack',
  remainingText = '00:00:00',
  elapsedText = '0s',
  progressPercent = 0,
  children,
}: SlaTimerProps) {
  const state = phase;

  return (
    <div
      role="timer"
      aria-label={`SLA timer: ${PHASE_LABELS[state]}`}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="sla-timer"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      {/* Countdown display */}
      <span
        data-part="countdown"
        aria-label={`Time remaining: ${remainingText}`}
      >
        {state === 'breached' ? 'BREACHED' : remainingText}
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
          aria-label={`Elapsed time: ${elapsedText}`}
        >
          Elapsed: {elapsedText}
        </span>
      )}

      {/* Pause/Resume control */}
      {state !== 'breached' && (
        <button
          type="button"
          data-part="pause-resume"
          aria-label={state === 'paused' ? 'Resume timer' : 'Pause timer'}
        >
          {state === 'paused' ? 'Resume' : 'Pause'}
        </button>
      )}

      {children}
    </div>
  );
}

export { SlaTimer };
