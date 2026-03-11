import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ApprovalStepperState = 'viewing' | 'stepFocused' | 'acting';
export type ApprovalStepperEvent =
  | { type: 'FOCUS_STEP' }
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

/* --- Types --- */

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
  [key: string]: unknown;
  class?: string;
  steps: ApprovalStep[];
  currentStep: string;
  status: string;
  assignee?: string;
  dueAt?: string;
  variant?: 'sequential' | 'parallel' | 'mixed';
  orientation?: 'horizontal' | 'vertical';
  showSLA?: boolean;
  showAssignee?: boolean;
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string) => void;
  onDelegate?: (stepId: string) => void;
  onClaim?: (stepId: string) => void;
}
export interface ApprovalStepperResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

function stepStatusIcon(status: ApprovalStep['status']): string {
  switch (status) {
    case 'approved': return '\u2713';
    case 'rejected': return '\u2717';
    case 'skipped': return '\u2014';
    case 'active': return '\u25CF';
    case 'pending': default: return '\u25CB';
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
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) { const days = Math.floor(hours / 24); return `${days}d ${hours % 24}h`; }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/* --- Component --- */

export function ApprovalStepper(props: ApprovalStepperProps): ApprovalStepperResult {
  const sig = surfaceCreateSignal<ApprovalStepperState>('viewing');
  const send = (type: string) => sig.set(approvalStepperReducer(sig.get(), { type } as any));

  const steps = (props.steps ?? []) as ApprovalStep[];
  const currentStep = (props.currentStep as string) ?? '';
  const variant = (props.variant as string) ?? 'sequential';
  const orientation = (props.orientation as string) ?? 'horizontal';
  const showSLA = props.showSLA !== false;
  const showAssignee = props.showAssignee !== false;
  const dueAt = props.dueAt as string | undefined;
  const onApprove = props.onApprove as ((id: string) => void) | undefined;
  const onReject = props.onReject as ((id: string) => void) | undefined;
  const onDelegate = props.onDelegate as ((id: string) => void) | undefined;

  let focusIndex = 0;
  let actingStepId: string | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'approval-stepper');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Approval steps');
  root.setAttribute('data-variant', variant);
  root.setAttribute('data-orientation', orientation);
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const stepListEl = document.createElement('div');
  stepListEl.setAttribute('data-part', 'step-list');
  stepListEl.setAttribute('data-orientation', orientation);
  root.appendChild(stepListEl);

  function rebuild() {
    stepListEl.innerHTML = '';

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isCurrent = step.id === currentStep;
      const isFocused = focusIndex === i;
      const isActing = actingStepId === step.id && sig.get() === 'acting';
      const showConnector = i < steps.length - 1;

      const wrapperDiv = document.createElement('div');
      wrapperDiv.setAttribute('data-part', 'step-wrapper');

      // Step element
      const stepDiv = document.createElement('div');
      stepDiv.setAttribute('data-part', 'step');
      stepDiv.setAttribute('role', 'listitem');
      if (isCurrent) stepDiv.setAttribute('aria-current', 'step');
      stepDiv.setAttribute('aria-label', `Step ${i + 1}: ${step.label} \u2014 ${step.status}`);
      stepDiv.setAttribute('data-status', step.status);
      stepDiv.setAttribute('data-current', isCurrent ? 'true' : 'false');
      stepDiv.setAttribute('tabindex', isFocused ? '0' : '-1');

      // Step indicator
      const indicatorDiv = document.createElement('div');
      indicatorDiv.setAttribute('data-part', 'step-indicator');
      indicatorDiv.setAttribute('data-index', String(i + 1));
      indicatorDiv.setAttribute('data-status', step.status);
      indicatorDiv.setAttribute('aria-hidden', 'true');
      const indicatorSpan = document.createElement('span');
      indicatorSpan.textContent = step.status === 'pending' || step.status === 'active' ? String(i + 1) : stepStatusIcon(step.status);
      indicatorDiv.appendChild(indicatorSpan);
      stepDiv.appendChild(indicatorDiv);

      // Step label
      const labelSpan = document.createElement('span');
      labelSpan.setAttribute('data-part', 'step-label');
      labelSpan.textContent = step.label;
      stepDiv.appendChild(labelSpan);

      // Assignee
      if (showAssignee && step.approver) {
        const assigneeDiv = document.createElement('div');
        assigneeDiv.setAttribute('data-part', 'step-assignee');
        assigneeDiv.setAttribute('data-visible', 'true');
        const assigneeSpan = document.createElement('span');
        assigneeSpan.setAttribute('data-part', 'assignee-name');
        assigneeSpan.textContent = step.approver;
        assigneeDiv.appendChild(assigneeSpan);
        stepDiv.appendChild(assigneeDiv);
      }

      // Status badge
      const statusDiv = document.createElement('div');
      statusDiv.setAttribute('data-part', 'step-status');
      statusDiv.setAttribute('data-status', step.status);
      statusDiv.innerHTML = `<span>${step.status}</span>`;
      stepDiv.appendChild(statusDiv);

      // Quorum display
      if (variant !== 'sequential' && step.quorumRequired) {
        const quorumDiv = document.createElement('div');
        quorumDiv.setAttribute('data-part', 'quorum-display');
        quorumDiv.setAttribute('aria-label', `${step.quorumCurrent ?? 0} of ${step.quorumRequired} approvals`);
        const quorumSpan = document.createElement('span');
        quorumSpan.setAttribute('data-part', 'quorum-count');
        quorumSpan.textContent = `${step.quorumCurrent ?? 0}/${step.quorumRequired}`;
        quorumDiv.appendChild(quorumSpan);
        stepDiv.appendChild(quorumDiv);
      }

      // Timestamp
      if (step.timestamp) {
        const tsSpan = document.createElement('span');
        tsSpan.setAttribute('data-part', 'step-timestamp');
        tsSpan.textContent = step.timestamp;
        stepDiv.appendChild(tsSpan);
      }

      stepDiv.addEventListener('click', () => {
        focusIndex = i;
        send('FOCUS_STEP');
        rebuild();
      });
      stepDiv.addEventListener('dblclick', () => {
        if (isCurrent || step.status === 'active') {
          actingStepId = step.id;
          send('START_ACTION');
          rebuild();
        }
      });

      wrapperDiv.appendChild(stepDiv);

      // Action bar
      if (isActing) {
        const actionBarDiv = document.createElement('div');
        actionBarDiv.setAttribute('data-part', 'action-bar');
        actionBarDiv.setAttribute('role', 'toolbar');
        actionBarDiv.setAttribute('aria-label', 'Approval actions');
        actionBarDiv.setAttribute('data-visible', 'true');

        const approveBtn = document.createElement('button');
        approveBtn.type = 'button';
        approveBtn.setAttribute('data-part', 'approve-button');
        approveBtn.setAttribute('aria-label', `Approve step: ${step.label}`);
        approveBtn.textContent = 'Approve';
        approveBtn.addEventListener('click', () => { onApprove?.(step.id); send('COMPLETE'); actingStepId = null; rebuild(); });
        actionBarDiv.appendChild(approveBtn);

        const rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.setAttribute('data-part', 'reject-button');
        rejectBtn.setAttribute('aria-label', `Reject step: ${step.label}`);
        rejectBtn.textContent = 'Reject';
        rejectBtn.addEventListener('click', () => { onReject?.(step.id); send('COMPLETE'); actingStepId = null; rebuild(); });
        actionBarDiv.appendChild(rejectBtn);

        const delegateBtn = document.createElement('button');
        delegateBtn.type = 'button';
        delegateBtn.setAttribute('data-part', 'delegate-button');
        delegateBtn.setAttribute('aria-label', `Delegate step: ${step.label}`);
        delegateBtn.textContent = 'Delegate';
        delegateBtn.addEventListener('click', () => { onDelegate?.(step.id); send('COMPLETE'); actingStepId = null; rebuild(); });
        actionBarDiv.appendChild(delegateBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.setAttribute('data-part', 'cancel-action-button');
        cancelBtn.setAttribute('aria-label', 'Cancel');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => { send('CANCEL'); actingStepId = null; rebuild(); });
        actionBarDiv.appendChild(cancelBtn);

        wrapperDiv.appendChild(actionBarDiv);
      }

      // Connector
      if (showConnector) {
        const connectorDiv = document.createElement('div');
        connectorDiv.setAttribute('data-part', 'connector');
        connectorDiv.setAttribute('data-orientation', orientation);
        connectorDiv.setAttribute('data-status', connectorStatus(step.status));
        connectorDiv.setAttribute('aria-hidden', 'true');
        wrapperDiv.appendChild(connectorDiv);
      }

      stepListEl.appendChild(wrapperDiv);
    }
  }

  rebuild();

  // SLA indicator
  if (showSLA && dueAt) {
    const slaDiv = document.createElement('div');
    slaDiv.setAttribute('data-part', 'sla-indicator');
    slaDiv.setAttribute('role', 'timer');
    slaDiv.setAttribute('aria-label', 'Time remaining');
    slaDiv.setAttribute('data-visible', 'true');
    slaDiv.setAttribute('data-due', dueAt);
    slaDiv.setAttribute('data-overdue', new Date(dueAt).getTime() < Date.now() ? 'true' : 'false');

    const slaLabel = document.createElement('span');
    slaLabel.setAttribute('data-part', 'sla-label');
    slaLabel.textContent = 'SLA: ';
    slaDiv.appendChild(slaLabel);

    const slaCountdown = document.createElement('span');
    slaCountdown.setAttribute('data-part', 'sla-countdown');
    slaCountdown.textContent = formatTimeRemaining(dueAt);
    slaDiv.appendChild(slaCountdown);

    root.appendChild(slaDiv);
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    if (e.key === nextKey || e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex = Math.min(focusIndex + 1, steps.length - 1);
      send('FOCUS_STEP');
      rebuild();
    }
    if (e.key === prevKey || e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex = Math.max(focusIndex - 1, 0);
      send('FOCUS_STEP');
      rebuild();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const step = steps[focusIndex];
      if (step && (step.status === 'active' || step.id === currentStep)) {
        actingStepId = step.id;
        send('START_ACTION');
        rebuild();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      actingStepId = null;
      send('CANCEL');
      rebuild();
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ApprovalStepper;
