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

function stepStatusIcon(status: string): string {
  switch (status) {
    case 'approved': return '\u2713';
    case 'rejected': return '\u2717';
    case 'skipped': return '\u2014';
    case 'active': return '\u25CF';
    default: return '\u25CB';
  }
}

export interface ApprovalStepperProps { [key: string]: unknown; class?: string; }
export interface ApprovalStepperResult { element: HTMLElement; dispose: () => void; }

export function ApprovalStepper(props: ApprovalStepperProps): ApprovalStepperResult {
  const sig = surfaceCreateSignal<ApprovalStepperState>('viewing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(approvalStepperReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'approval-stepper');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Approval steps');
  root.setAttribute('data-variant', 'sequential');
  root.setAttribute('data-orientation', 'horizontal');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Step list container */
  const stepListEl = document.createElement('div');
  stepListEl.setAttribute('data-part', 'step-list');
  stepListEl.setAttribute('data-orientation', 'horizontal');

  /* Step wrapper with step + connector */
  const stepWrapperEl = document.createElement('div');
  stepWrapperEl.setAttribute('data-part', 'step-wrapper');

  /* Step element */
  const stepEl = document.createElement('div');
  stepEl.setAttribute('data-part', 'step');
  stepEl.setAttribute('role', 'listitem');
  stepEl.setAttribute('data-status', 'pending');
  stepEl.setAttribute('data-current', 'false');
  stepEl.setAttribute('tabindex', '0');
  stepEl.style.cursor = 'pointer';
  stepEl.addEventListener('click', () => { send('FOCUS_STEP'); });
  stepEl.addEventListener('dblclick', () => { send('START_ACTION'); });

  /* Step indicator */
  const stepIndicatorEl = document.createElement('div');
  stepIndicatorEl.setAttribute('data-part', 'step-indicator');
  stepIndicatorEl.setAttribute('data-index', '1');
  stepIndicatorEl.setAttribute('data-status', 'pending');
  stepIndicatorEl.setAttribute('aria-hidden', 'true');
  const indicatorSpan = document.createElement('span');
  indicatorSpan.textContent = '1';
  stepIndicatorEl.appendChild(indicatorSpan);
  stepEl.appendChild(stepIndicatorEl);

  /* Step label */
  const stepLabelEl = document.createElement('span');
  stepLabelEl.setAttribute('data-part', 'step-label');
  stepLabelEl.textContent = 'Review';
  stepEl.appendChild(stepLabelEl);

  /* Step assignee */
  const stepAssigneeEl = document.createElement('div');
  stepAssigneeEl.setAttribute('data-part', 'step-assignee');
  stepAssigneeEl.setAttribute('data-visible', 'true');
  const assigneeNameEl = document.createElement('span');
  assigneeNameEl.setAttribute('data-part', 'assignee-name');
  assigneeNameEl.textContent = 'Assignee';
  stepAssigneeEl.appendChild(assigneeNameEl);
  stepEl.appendChild(stepAssigneeEl);

  /* Step status badge */
  const stepStatusEl = document.createElement('div');
  stepStatusEl.setAttribute('data-part', 'step-status');
  stepStatusEl.setAttribute('data-status', 'pending');
  const stepStatusSpan = document.createElement('span');
  stepStatusSpan.textContent = 'pending';
  stepStatusEl.appendChild(stepStatusSpan);
  stepEl.appendChild(stepStatusEl);

  /* Step timestamp */
  const stepTimestampEl = document.createElement('span');
  stepTimestampEl.setAttribute('data-part', 'step-timestamp');
  stepTimestampEl.textContent = '';
  stepEl.appendChild(stepTimestampEl);

  stepWrapperEl.appendChild(stepEl);

  /* Action bar (shown in acting state) */
  const actionBarEl = document.createElement('div');
  actionBarEl.setAttribute('data-part', 'action-bar');
  actionBarEl.setAttribute('role', 'toolbar');
  actionBarEl.setAttribute('aria-label', 'Approval actions');
  actionBarEl.setAttribute('data-visible', 'false');
  actionBarEl.style.display = 'none';

  const approveBtn = document.createElement('button');
  approveBtn.type = 'button';
  approveBtn.setAttribute('data-part', 'approve-button');
  approveBtn.setAttribute('aria-label', 'Approve step');
  approveBtn.textContent = 'Approve';
  approveBtn.addEventListener('click', () => { send('COMPLETE'); });
  actionBarEl.appendChild(approveBtn);

  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.setAttribute('data-part', 'reject-button');
  rejectBtn.setAttribute('aria-label', 'Reject step');
  rejectBtn.textContent = 'Reject';
  rejectBtn.addEventListener('click', () => { send('COMPLETE'); });
  actionBarEl.appendChild(rejectBtn);

  const delegateBtn = document.createElement('button');
  delegateBtn.type = 'button';
  delegateBtn.setAttribute('data-part', 'delegate-button');
  delegateBtn.setAttribute('aria-label', 'Delegate step');
  delegateBtn.textContent = 'Delegate';
  delegateBtn.addEventListener('click', () => { send('COMPLETE'); });
  actionBarEl.appendChild(delegateBtn);

  const cancelActionBtn = document.createElement('button');
  cancelActionBtn.type = 'button';
  cancelActionBtn.setAttribute('data-part', 'cancel-action-button');
  cancelActionBtn.setAttribute('aria-label', 'Cancel');
  cancelActionBtn.textContent = 'Cancel';
  cancelActionBtn.addEventListener('click', () => { send('CANCEL'); });
  actionBarEl.appendChild(cancelActionBtn);

  stepWrapperEl.appendChild(actionBarEl);

  /* Connector between steps */
  const connectorEl = document.createElement('div');
  connectorEl.setAttribute('data-part', 'connector');
  connectorEl.setAttribute('data-orientation', 'horizontal');
  connectorEl.setAttribute('data-status', 'pending');
  connectorEl.setAttribute('aria-hidden', 'true');
  stepWrapperEl.appendChild(connectorEl);

  stepListEl.appendChild(stepWrapperEl);
  root.appendChild(stepListEl);

  /* SLA indicator */
  const slaIndicatorEl = document.createElement('div');
  slaIndicatorEl.setAttribute('data-part', 'sla-indicator');
  slaIndicatorEl.setAttribute('role', 'timer');
  slaIndicatorEl.setAttribute('aria-label', 'Time remaining');
  slaIndicatorEl.setAttribute('data-visible', 'false');
  slaIndicatorEl.style.display = 'none';
  const slaLabel = document.createElement('span');
  slaLabel.setAttribute('data-part', 'sla-label');
  slaLabel.textContent = 'SLA: ';
  slaIndicatorEl.appendChild(slaLabel);
  const slaCountdown = document.createElement('span');
  slaCountdown.setAttribute('data-part', 'sla-countdown');
  slaCountdown.textContent = '';
  slaIndicatorEl.appendChild(slaCountdown);
  root.appendChild(slaIndicatorEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      send('FOCUS_STEP');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      send('FOCUS_STEP');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      send('START_ACTION');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      send('CANCEL');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isActing = s === 'acting';
    actionBarEl.setAttribute('data-visible', isActing ? 'true' : 'false');
    actionBarEl.style.display = isActing ? 'flex' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default ApprovalStepper;
