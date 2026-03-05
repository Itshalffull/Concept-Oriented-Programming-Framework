/* ---------------------------------------------------------------------------
 * ExecutionOverlay — Server Component
 *
 * Runtime state overlay for process execution. Renders step status
 * highlights, active step indicator, flow animation markers, status bar,
 * control buttons, elapsed time, and error banner.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'active' | 'complete' | 'pending' | 'failed' | 'skipped';
}

export interface ExecutionOverlayProps {
  /** Current execution status label. */
  status: string;
  /** Currently active step identifier. */
  activeStep?: string | undefined;
  /** ISO datetime when execution started. */
  startedAt?: string | undefined;
  /** ISO datetime when execution ended. */
  endedAt?: string | undefined;
  /** Display mode. */
  mode?: 'live' | 'replay' | 'static';
  /** Whether to show suspend/resume/cancel controls. */
  showControls?: boolean;
  /** Whether to show elapsed time counter. */
  showElapsed?: boolean;
  /** Whether to animate flow edges. */
  animateFlow?: boolean;
  /** Steps in the execution path. */
  steps?: ExecutionStep[];
  /** Error message when execution fails. */
  errorMessage?: string;
  /** Server-computed elapsed time string. */
  elapsedText?: string;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function statusIcon(stepStatus: ExecutionStep['status']): string {
  switch (stepStatus) {
    case 'complete': return '\u2713';
    case 'active': return '\u25CF';
    case 'failed': return '\u2717';
    case 'skipped': return '\u2014';
    case 'pending':
    default: return '\u25CB';
  }
}

function deriveState(status: string): string {
  switch (status) {
    case 'running': return 'live';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'suspended': return 'suspended';
    case 'cancelled': return 'cancelled';
    default: return 'idle';
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ExecutionOverlay({
  status,
  activeStep,
  mode = 'live',
  showControls = true,
  showElapsed = true,
  animateFlow = true,
  steps = [],
  errorMessage,
  elapsedText = '',
  children,
}: ExecutionOverlayProps) {
  const state = deriveState(status);
  const isFlowAnimating = animateFlow && (state === 'live' || state === 'replay');

  return (
    <div
      role="group"
      aria-label={`Process execution: ${status}`}
      aria-busy={state === 'live'}
      data-surface-widget=""
      data-widget-name="execution-overlay"
      data-part="root"
      data-state={state}
      data-mode={mode}
      tabIndex={0}
    >
      {/* Per-node status highlights */}
      {steps.map((step) => (
        <div
          key={step.id}
          data-part="node-overlay"
          data-status={step.status}
          data-step-id={step.id}
          aria-hidden="true"
        >
          <span data-part="step-icon">{statusIcon(step.status)}</span>
          <span data-part="step-label">{step.label}</span>
        </div>
      ))}

      {/* Active step marker */}
      <div
        data-part="active-marker"
        data-step={activeStep ?? ''}
        data-visible={activeStep ? 'true' : 'false'}
        aria-hidden={!activeStep}
      >
        {activeStep && (
          <span data-part="pulse-indicator" aria-label={`Active step: ${activeStep}`}>
            {'\u25CF'}
          </span>
        )}
      </div>

      {/* Flow animation indicator */}
      <div
        data-part="flow-animation"
        data-active={isFlowAnimating ? 'true' : 'false'}
        aria-hidden="true"
      />

      {/* Status bar */}
      <div
        data-part="status-bar"
        role="status"
        aria-live="polite"
        data-status={status}
      >
        <span data-part="status-label">{status}</span>

        {showElapsed && elapsedText && (
          <span
            data-part="elapsed"
            data-visible="true"
            aria-label={`Elapsed time: ${elapsedText}`}
          >
            {elapsedText}
          </span>
        )}
      </div>

      {/* Control buttons */}
      {showControls && (
        <div
          data-part="controls"
          role="toolbar"
          aria-label="Execution controls"
          data-visible="true"
        >
          {state === 'live' && (
            <button
              type="button"
              data-part="suspend-button"
              aria-label="Suspend execution"
            >
              Suspend
            </button>
          )}
          {state === 'suspended' && (
            <button
              type="button"
              data-part="resume-button"
              aria-label="Resume execution"
            >
              Resume
            </button>
          )}
          {(state === 'live' || state === 'suspended') && (
            <button
              type="button"
              data-part="cancel-button"
              aria-label="Cancel execution"
            >
              Cancel
            </button>
          )}
          {state === 'failed' && (
            <button
              type="button"
              data-part="retry-button"
              aria-label="Retry execution"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Error banner */}
      <div
        data-part="error-banner"
        role="alert"
        aria-live="assertive"
        data-visible={state === 'failed' ? 'true' : 'false'}
      >
        {state === 'failed' && (
          <span data-part="error-message">{errorMessage ?? 'Execution failed'}</span>
        )}
      </div>

      {children}
    </div>
  );
}

export { ExecutionOverlay };
