/* ---------------------------------------------------------------------------
 * ApprovalStepper — Multi-step approval flow visualization
 *
 * Shows sequential or parallel approval stages with assignee, status,
 * timestamp, and optional form data. Supports M-of-N quorum display
 * for parallel approvals and SLA countdown for time-sensitive approvals.
 * ------------------------------------------------------------------------- */

export type ApprovalStepperState = 'viewing' | 'stepFocused' | 'acting';
export type ApprovalStepperEvent =
  | { type: 'FOCUS_STEP'; id?: string }
  | { type: 'START_ACTION' }
  | { type: 'BLUR' }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' };

export function approvalStepperReducer(state: ApprovalStepperState, event: ApprovalStepperEvent): ApprovalStepperState {
  switch (state) {
    case 'viewing':
      if (event.type === 'FOCUS_STEP') return 'stepFocused';
      if (event.type === 'START_ACTION') return 'acting';
      return state;
    case 'stepFocused':
      if (event.type === 'BLUR') return 'viewing';
      if (event.type === 'START_ACTION') return 'acting';
      return state;
    case 'acting':
      if (event.type === 'COMPLETE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ApprovalStep {
  id: string;
  label: string;
  approver?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'active';
  timestamp?: string;
  /** For parallel approvals: required approvals count */
  quorumRequired?: number;
  /** For parallel approvals: current approvals count */
  quorumCurrent?: number;
}

export interface ApprovalStepperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Ordered list of approval steps */
  steps: ApprovalStep[];
  /** Current step identifier */
  currentStep: string;
  /** Overall approval status */
  status: string;
  /** Current assignee */
  assignee?: string | undefined;
  /** Due date as ISO string */
  dueAt?: string | undefined;
  /** Layout variant */
  variant?: 'sequential' | 'parallel' | 'mixed';
  /** Visual orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Whether to show SLA countdown */
  showSLA?: boolean;
  /** Whether to show assignee info */
  showAssignee?: boolean;
  /** Called when a step is approved */
  onApprove?: (stepId: string) => void;
  /** Called when a step is rejected */
  onReject?: (stepId: string) => void;
  /** Called when a step is delegated */
  onDelegate?: (stepId: string) => void;
  /** Called when the current step is claimed */
  onClaim?: (stepId: string) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function stepStatusIcon(status: ApprovalStep['status']): string {
  switch (status) {
    case 'approved': return '\u2713';
    case 'rejected': return '\u2717';
    case 'skipped': return '\u2014';
    case 'active': return '\u25CF';
    case 'pending':
    default: return '\u25CB';
  }
}

function connectorStatus(prevStatus: ApprovalStep['status']): string {
  switch (prevStatus) {
    case 'approved': return 'complete';
    case 'rejected': return 'rejected';
    case 'active': return 'active';
    default: return 'pending';
  }
}

function formatTimeRemaining(dueAt: string): string {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ApprovalStepper = forwardRef<HTMLDivElement, ApprovalStepperProps>(function ApprovalStepper(
  {
    steps,
    currentStep,
    status,
    assignee,
    dueAt,
    variant = 'sequential',
    orientation = 'horizontal',
    showSLA = true,
    showAssignee = true,
    onApprove,
    onReject,
    onDelegate,
    onClaim,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(approvalStepperReducer, 'viewing');
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [actingStepId, setActingStepId] = useState<string | null>(null);

  const handleFocusStep = useCallback((id: string, index: number) => {
    setFocusedStepId(id);
    setFocusIndex(index);
    send({ type: 'FOCUS_STEP', id });
  }, []);

  const handleStartAction = useCallback((stepId: string) => {
    setActingStepId(stepId);
    send({ type: 'START_ACTION' });
  }, []);

  const handleApprove = useCallback((stepId: string) => {
    onApprove?.(stepId);
    send({ type: 'COMPLETE' });
    setActingStepId(null);
  }, [onApprove]);

  const handleReject = useCallback((stepId: string) => {
    onReject?.(stepId);
    send({ type: 'COMPLETE' });
    setActingStepId(null);
  }, [onReject]);

  const handleDelegate = useCallback((stepId: string) => {
    onDelegate?.(stepId);
    send({ type: 'COMPLETE' });
    setActingStepId(null);
  }, [onDelegate]);

  const handleCancelAction = useCallback(() => {
    send({ type: 'CANCEL' });
    setActingStepId(null);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    if (e.key === nextKey || e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(focusIndex + 1, steps.length - 1);
      handleFocusStep(steps[newIndex].id, newIndex);
    }
    if (e.key === prevKey || e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(focusIndex - 1, 0);
      handleFocusStep(steps[newIndex].id, newIndex);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const step = steps[focusIndex];
      if (step && (step.status === 'active' || step.id === currentStep)) {
        handleStartAction(step.id);
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelAction();
    }
  }, [focusIndex, steps, currentStep, orientation, handleFocusStep, handleStartAction, handleCancelAction]);

  return (
    <div
      ref={ref}
      role="list"
      aria-label="Approval steps"
      data-surface-widget=""
      data-widget-name="approval-stepper"
      data-part="root"
      data-variant={variant}
      data-orientation={orientation}
      data-state={state}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      <div data-part="step-list" data-orientation={orientation}>
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isFocused = focusIndex === index;
          const isActing = actingStepId === step.id && state === 'acting';
          const showConnector = index < steps.length - 1;

          return (
            <div key={step.id} data-part="step-wrapper">
              <div
                data-part="step"
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label} \u2014 ${step.status}`}
                data-status={step.status}
                data-current={isCurrent ? 'true' : 'false'}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => handleFocusStep(step.id, index)}
                onDoubleClick={() => {
                  if (isCurrent || step.status === 'active') {
                    handleStartAction(step.id);
                  }
                }}
              >
                {/* Step indicator (numbered circle or status icon) */}
                <div
                  data-part="step-indicator"
                  data-index={index + 1}
                  data-status={step.status}
                  aria-hidden="true"
                >
                  <span>{step.status === 'pending' || step.status === 'active' ? index + 1 : stepStatusIcon(step.status)}</span>
                </div>

                {/* Step label */}
                <span data-part="step-label">{step.label}</span>

                {/* Assignee */}
                {showAssignee && step.approver && (
                  <div data-part="step-assignee" data-visible="true">
                    <span data-part="assignee-name">{step.approver}</span>
                  </div>
                )}

                {/* Status badge */}
                <div data-part="step-status" data-status={step.status}>
                  <span>{step.status}</span>
                </div>

                {/* Quorum display for parallel variant */}
                {variant !== 'sequential' && step.quorumRequired && (
                  <div data-part="quorum-display" aria-label={`${step.quorumCurrent ?? 0} of ${step.quorumRequired} approvals`}>
                    <span data-part="quorum-count">{step.quorumCurrent ?? 0}/{step.quorumRequired}</span>
                  </div>
                )}

                {/* Timestamp */}
                {step.timestamp && (
                  <span data-part="step-timestamp">{step.timestamp}</span>
                )}
              </div>

              {/* Action bar (only shown for acting state on the active step) */}
              {isActing && (
                <div
                  data-part="action-bar"
                  role="toolbar"
                  aria-label="Approval actions"
                  data-visible="true"
                >
                  <button
                    type="button"
                    data-part="approve-button"
                    onClick={() => handleApprove(step.id)}
                    aria-label={`Approve step: ${step.label}`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    data-part="reject-button"
                    onClick={() => handleReject(step.id)}
                    aria-label={`Reject step: ${step.label}`}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    data-part="delegate-button"
                    onClick={() => handleDelegate(step.id)}
                    aria-label={`Delegate step: ${step.label}`}
                  >
                    Delegate
                  </button>
                  <button
                    type="button"
                    data-part="cancel-action-button"
                    onClick={handleCancelAction}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Connector line between steps */}
              {showConnector && (
                <div
                  data-part="connector"
                  data-orientation={orientation}
                  data-status={connectorStatus(step.status)}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* SLA indicator */}
      {showSLA && dueAt && (
        <div
          data-part="sla-indicator"
          role="timer"
          aria-label="Time remaining"
          data-visible="true"
          data-due={dueAt}
          data-overdue={new Date(dueAt).getTime() < Date.now() ? 'true' : 'false'}
        >
          <span data-part="sla-label">SLA: </span>
          <span data-part="sla-countdown">{formatTimeRemaining(dueAt)}</span>
        </div>
      )}

      {children}
    </div>
  );
});

ApprovalStepper.displayName = 'ApprovalStepper';
export { ApprovalStepper };
export default ApprovalStepper;
