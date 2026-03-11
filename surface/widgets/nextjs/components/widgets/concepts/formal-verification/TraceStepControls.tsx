import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

const SPEED_OPTIONS = [1, 2, 4] as const;

export interface TraceStepControlsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  speed?: number;
  showSpeed?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function TraceStepControls({
  currentStep,
  totalSteps,
  playing,
  speed = 1,
  showSpeed = true,
  children,
  ...rest
}: TraceStepControlsProps) {
  const atFirst = currentStep <= 0;
  const atLast = currentStep >= totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const state = playing ? 'playing' : 'paused';

  return (
    <div
      role="toolbar"
      aria-label="Trace step controls"
      data-surface-widget=""
      data-widget-name="trace-step-controls"
      data-part="root"
      data-state={state}
      tabIndex={0}
      {...rest}
    >
      {/* Transport controls */}
      <div data-part="transport" data-state={state}>
        <button
          type="button"
          data-part="jump-start"
          data-state={state}
          aria-label="Jump to start"
          aria-disabled={atFirst ? 'true' : 'false'}
          disabled={atFirst}
          tabIndex={0}
        >
          {'\u25C4\u2502'}
        </button>

        <button
          type="button"
          data-part="step-back"
          data-state={state}
          aria-label="Step backward"
          aria-disabled={atFirst ? 'true' : 'false'}
          disabled={atFirst}
          tabIndex={-1}
        >
          {'\u25C4'}
        </button>

        <button
          type="button"
          data-part="play-pause"
          data-state={state}
          aria-label={playing ? 'Pause' : 'Play'}
          tabIndex={-1}
        >
          {playing ? '\u23F8' : '\u25B6'}
        </button>

        <button
          type="button"
          data-part="step-fwd"
          data-state={state}
          aria-label="Step forward"
          aria-disabled={atLast ? 'true' : 'false'}
          disabled={atLast}
          tabIndex={-1}
        >
          {'\u25BA'}
        </button>

        <button
          type="button"
          data-part="jump-end"
          data-state={state}
          aria-label="Jump to end"
          aria-disabled={atLast ? 'true' : 'false'}
          disabled={atLast}
          tabIndex={-1}
        >
          {'\u2502\u25BA'}
        </button>
      </div>

      {/* Step counter */}
      <span
        data-part="step-counter"
        data-state={state}
        role="status"
        aria-live="polite"
        aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
      >
        Step {currentStep + 1} of {totalSteps}
      </span>

      {/* Progress bar */}
      <div
        data-part="progress-bar"
        data-state={state}
        role="progressbar"
        aria-valuenow={currentStep + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label="Trace progress"
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <div
          data-part="progress-fill"
          data-state={state}
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>

      {/* Speed control */}
      {showSpeed && (
        <div data-part="speed-control" data-state={state} data-visible="true">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              data-part="speed-option"
              data-state={state}
              data-selected={s === speed ? 'true' : 'false'}
              aria-label={`Playback speed ${s}x`}
              aria-pressed={s === speed ? 'true' : 'false'}
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

export { TraceStepControls };
