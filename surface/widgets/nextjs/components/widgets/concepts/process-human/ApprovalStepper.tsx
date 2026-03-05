/* ---------------------------------------------------------------------------
 * ApprovalStepper — Server Component
 *
 * Multi-step approval flow visualization showing sequential or parallel
 * approval stages with assignee, status, timestamp, quorum display,
 * and SLA countdown.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ApprovalStep {
  id: string;
  label: string;
  approver?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'active';
  timestamp?: string;
  quorumRequired?: number;
  quorumCurrent?: number;
}

export interface ApprovalStepperProps {
  /** Ordered list of approval steps. */
  steps: ApprovalStep[];
  /** Current step identifier. */
  currentStep: string;
  /** Overall approval status. */
  status: string;
  /** Current assignee. */
  assignee?: string | undefined;
  /** Due date as ISO string. */
  dueAt?: string | undefined;
  /** Layout variant. */
  variant?: 'sequential' | 'parallel' | 'mixed';
  /** Visual orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Whether to show SLA countdown. */
  showSLA?: boolean;
  /** Whether to show assignee info. */
  showAssignee?: boolean;
  /** Server-computed time remaining string. */
  timeRemaining?: string;
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

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ApprovalStepper({
  steps,
  currentStep,
  status: _status,
  variant = 'sequential',
  orientation = 'horizontal',
  showSLA = true,
  showAssignee = true,
  dueAt,
  timeRemaining,
  children,
}: ApprovalStepperProps) {
  return (
    <div
      role="list"
      aria-label="Approval steps"
      data-surface-widget=""
      data-widget-name="approval-stepper"
      data-part="root"
      data-variant={variant}
      data-orientation={orientation}
      data-state="viewing"
      tabIndex={0}
    >
      <div data-part="step-list" data-orientation={orientation}>
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
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
                tabIndex={index === 0 ? 0 : -1}
              >
                {/* Step indicator */}
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

              {/* Action bar placeholder for active steps */}
              {isCurrent && step.status === 'active' && (
                <div
                  data-part="action-bar"
                  role="toolbar"
                  aria-label="Approval actions"
                  data-visible="true"
                >
                  <button
                    type="button"
                    data-part="approve-button"
                    aria-label={`Approve step: ${step.label}`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    data-part="reject-button"
                    aria-label={`Reject step: ${step.label}`}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    data-part="delegate-button"
                    aria-label={`Delegate step: ${step.label}`}
                  >
                    Delegate
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
        >
          <span data-part="sla-label">SLA: </span>
          <span data-part="sla-countdown">{timeRemaining ?? dueAt}</span>
        </div>
      )}

      {children}
    </div>
  );
}

export { ApprovalStepper };
