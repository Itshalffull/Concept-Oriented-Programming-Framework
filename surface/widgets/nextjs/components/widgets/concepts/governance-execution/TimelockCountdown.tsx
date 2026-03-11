import type { HTMLAttributes, ReactNode } from 'react';

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

export interface TimelockCountdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  phase: string;
  deadline: string;
  elapsed: number;
  total: number;
  showChallenge?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  variant?: 'phase-based' | 'simple';
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function TimelockCountdown({
  phase,
  deadline,
  elapsed,
  total,
  showChallenge = true,
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
  variant = 'phase-based',
  children,
  ...restProps
}: TimelockCountdownProps) {
  const deadlineDate = new Date(deadline);
  const timeRemaining = computeTimeRemaining(deadlineDate);
  const isExpired = timeRemaining.totalMs <= 0;

  // Derive state from props
  const progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
  let state: string;
  if (isExpired) {
    state = 'expired';
  } else if (progress >= criticalThreshold) {
    state = 'critical';
  } else if (progress >= warningThreshold) {
    state = 'warning';
  } else {
    state = 'running';
  }

  const countdownText = formatRemaining(timeRemaining);

  const formattedDeadline = (() => {
    try {
      return deadlineDate.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return deadline;
    }
  })();

  const displayPhase = isExpired ? 'Ready to execute' : phase;
  const progressPercent = Math.round(progress * 100);
  const ariaLabel = `${displayPhase}: ${countdownText}`;

  return (
    <div
      role="timer"
      aria-label={ariaLabel}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="timelock-countdown"
      data-part="root"
      data-state={state}
      data-variant={variant}
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
        {countdownText}
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
          }}
        />
      </div>

      {/* Execute button */}
      <button
        type="button"
        data-part="execute-button"
        data-state={state}
        aria-label="Execute proposal"
        aria-disabled={!isExpired}
        disabled={!isExpired}
        tabIndex={0}
      >
        Execute
      </button>

      {/* Challenge button */}
      {showChallenge && (
        <button
          type="button"
          data-part="challenge-button"
          data-state={state}
          data-visible="true"
          aria-label="Challenge execution"
          aria-disabled={isExpired}
          disabled={isExpired}
          tabIndex={0}
        >
          Challenge
        </button>
      )}

      {children}
    </div>
  );
}

export { TimelockCountdown };
