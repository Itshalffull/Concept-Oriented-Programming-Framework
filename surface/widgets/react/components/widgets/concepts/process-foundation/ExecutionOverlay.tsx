/* ---------------------------------------------------------------------------
 * ExecutionOverlay — Runtime state overlay for process execution
 *
 * Renders on top of a process diagram to show current execution state with
 * status-colored node highlights, active step indicator, token position
 * markers, and animated flow edges. Supports live, replay, and static modes.
 * ------------------------------------------------------------------------- */

export type ExecutionOverlayState = 'idle' | 'live' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'replay';
export type ExecutionOverlayEvent =
  | { type: 'START' }
  | { type: 'LOAD_REPLAY' }
  | { type: 'STEP_ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'FAIL'; error?: string }
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

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'active' | 'complete' | 'pending' | 'failed' | 'skipped';
}

export interface ExecutionOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current execution status label */
  status: string;
  /** Currently active step identifier */
  activeStep?: string | undefined;
  /** ISO datetime when execution started */
  startedAt?: string | undefined;
  /** ISO datetime when execution ended */
  endedAt?: string | undefined;
  /** Display mode */
  mode?: 'live' | 'replay' | 'static';
  /** Whether to show suspend/resume/cancel controls */
  showControls?: boolean;
  /** Whether to show elapsed time counter */
  showElapsed?: boolean;
  /** Whether to animate flow edges */
  animateFlow?: boolean;
  /** Steps in the execution path */
  steps?: ExecutionStep[];
  /** Error message when execution fails */
  errorMessage?: string;
  /** Called when suspend action is triggered */
  onSuspend?: () => void;
  /** Called when resume action is triggered */
  onResume?: () => void;
  /** Called when cancel action is triggered */
  onCancel?: () => void;
  /** Called when retry action is triggered */
  onRetry?: () => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function statusIcon(status: ExecutionStep['status']): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'active': return '\u25CF';
    case 'failed': return '\u2717';
    case 'skipped': return '\u2014';
    case 'pending':
    default: return '\u25CB';
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ExecutionOverlay = forwardRef<HTMLDivElement, ExecutionOverlayProps>(function ExecutionOverlay(
  {
    status,
    activeStep,
    startedAt,
    endedAt,
    mode = 'live',
    showControls = true,
    showElapsed = true,
    animateFlow = true,
    steps = [],
    errorMessage,
    onSuspend,
    onResume,
    onCancel,
    onRetry,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(executionOverlayReducer, 'idle');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-transition based on mode prop
  useEffect(() => {
    if (mode === 'replay' && state === 'idle') {
      send({ type: 'LOAD_REPLAY' });
    }
  }, [mode, state]);

  // Auto-start when status indicates running
  useEffect(() => {
    if (status === 'running' && state === 'idle') {
      send({ type: 'START' });
    } else if (status === 'completed' && state === 'live') {
      send({ type: 'COMPLETE' });
    } else if (status === 'failed' && state === 'live') {
      send({ type: 'FAIL' });
    } else if (status === 'suspended' && state === 'live') {
      send({ type: 'SUSPEND' });
    } else if (status === 'cancelled' && (state === 'live' || state === 'suspended')) {
      send({ type: 'CANCEL' });
    }
  }, [status, state]);

  // Elapsed time ticker
  useEffect(() => {
    if (state === 'live' && startedAt) {
      const start = new Date(startedAt).getTime();
      const tick = () => setElapsed(Date.now() - start);
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (state !== 'live' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Compute final elapsed for completed/failed states
    if ((state === 'completed' || state === 'failed' || state === 'cancelled') && startedAt) {
      const start = new Date(startedAt).getTime();
      const end = endedAt ? new Date(endedAt).getTime() : Date.now();
      setElapsed(end - start);
    }
  }, [state, startedAt, endedAt]);

  const handleSuspend = useCallback(() => {
    send({ type: 'SUSPEND' });
    onSuspend?.();
  }, [onSuspend]);

  const handleResume = useCallback(() => {
    send({ type: 'RESUME' });
    onResume?.();
  }, [onResume]);

  const handleCancel = useCallback(() => {
    send({ type: 'CANCEL' });
    onCancel?.();
  }, [onCancel]);

  const handleRetry = useCallback(() => {
    send({ type: 'RETRY' });
    onRetry?.();
  }, [onRetry]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (state === 'live') handleSuspend();
      else if (state === 'suspended') handleResume();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === 'live' || state === 'suspended') handleCancel();
    }
  }, [state, handleSuspend, handleResume, handleCancel]);

  const isFlowAnimating = animateFlow && (state === 'live' || state === 'replay');

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Process execution: ${status}`}
      aria-busy={state === 'live'}
      data-surface-widget=""
      data-widget-name="execution-overlay"
      data-part="root"
      data-state={state}
      data-mode={mode}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
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

        {/* Elapsed time */}
        {showElapsed && (
          <span
            data-part="elapsed"
            data-visible="true"
            aria-label={`Elapsed time: ${formatElapsed(elapsed)}`}
          >
            {formatElapsed(elapsed)}
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
              onClick={handleSuspend}
              aria-label="Suspend execution"
            >
              Suspend
            </button>
          )}
          {state === 'suspended' && (
            <button
              type="button"
              data-part="resume-button"
              onClick={handleResume}
              aria-label="Resume execution"
            >
              Resume
            </button>
          )}
          {(state === 'live' || state === 'suspended') && (
            <button
              type="button"
              data-part="cancel-button"
              onClick={handleCancel}
              aria-label="Cancel execution"
            >
              Cancel
            </button>
          )}
          {state === 'failed' && (
            <button
              type="button"
              data-part="retry-button"
              onClick={handleRetry}
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
});

ExecutionOverlay.displayName = 'ExecutionOverlay';
export { ExecutionOverlay };
export default ExecutionOverlay;
