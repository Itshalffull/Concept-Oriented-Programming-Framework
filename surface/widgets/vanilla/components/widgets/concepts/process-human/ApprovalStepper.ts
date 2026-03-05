/* ---------------------------------------------------------------------------
 * ApprovalStepper — Vanilla implementation
 *
 * Multi-step approval flow visualization with step indicators, connectors,
 * action bar (approve/reject/delegate), SLA countdown, quorum display,
 * and keyboard navigation.
 * ------------------------------------------------------------------------- */

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
  [key: string]: unknown; className?: string;
  steps?: ApprovalStep[];
  currentStep?: string;
  status?: string;
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
export interface ApprovalStepperOptions { target: HTMLElement; props: ApprovalStepperProps; }

let _approvalStepperUid = 0;

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
  switch (prevStatus) { case 'approved': return 'complete'; case 'rejected': return 'rejected'; case 'active': return 'active'; default: return 'pending'; }
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

export class ApprovalStepper {
  private el: HTMLElement;
  private props: ApprovalStepperProps;
  private state: ApprovalStepperState = 'viewing';
  private disposers: Array<() => void> = [];
  private focusedStepId: string | null = null;
  private focusIndex = 0;
  private actingStepId: string | null = null;

  constructor(options: ApprovalStepperOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'approval-stepper');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'list');
    this.el.setAttribute('aria-label', 'Approval steps');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'approval-stepper-' + (++_approvalStepperUid);
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = approvalStepperReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<ApprovalStepperProps>): void { Object.assign(this.props, props); this.cleanupRender(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get steps(): ApprovalStep[] { return (this.props.steps ?? []) as ApprovalStep[]; }
  private get currentStep(): string { return (this.props.currentStep as string) ?? ''; }
  private get orientation(): string { return (this.props.orientation as string) ?? 'horizontal'; }
  private get variant(): string { return (this.props.variant as string) ?? 'sequential'; }

  private handleKeyDown(e: KeyboardEvent): void {
    const nextKey = this.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevKey = this.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    if (e.key === nextKey || e.key === 'ArrowDown') { e.preventDefault(); const ni = Math.min(this.focusIndex + 1, this.steps.length - 1); this.handleFocusStep(this.steps[ni]?.id, ni); }
    if (e.key === prevKey || e.key === 'ArrowUp') { e.preventDefault(); const ni = Math.max(this.focusIndex - 1, 0); this.handleFocusStep(this.steps[ni]?.id, ni); }
    if (e.key === 'Enter') { e.preventDefault(); const step = this.steps[this.focusIndex]; if (step && (step.status === 'active' || step.id === this.currentStep)) this.handleStartAction(step.id); }
    if (e.key === 'Escape') { e.preventDefault(); this.handleCancelAction(); }
  }

  private handleFocusStep(id: string | undefined, index: number): void {
    if (!id) return;
    this.focusedStepId = id;
    this.focusIndex = index;
    this.send('FOCUS_STEP');
    this.rerender();
  }

  private handleStartAction(stepId: string): void { this.actingStepId = stepId; this.send('START_ACTION'); this.rerender(); }
  private handleApprove(stepId: string): void { this.props.onApprove?.(stepId); this.send('COMPLETE'); this.actingStepId = null; this.rerender(); }
  private handleReject(stepId: string): void { this.props.onReject?.(stepId); this.send('COMPLETE'); this.actingStepId = null; this.rerender(); }
  private handleDelegate(stepId: string): void { this.props.onDelegate?.(stepId); this.send('COMPLETE'); this.actingStepId = null; this.rerender(); }
  private handleCancelAction(): void { this.send('CANCEL'); this.actingStepId = null; this.rerender(); }

  private render(): void {
    const showSLA = this.props.showSLA !== false;
    const showAssignee = this.props.showAssignee !== false;
    const dueAt = this.props.dueAt as string | undefined;

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-variant', this.variant);
    this.el.setAttribute('data-orientation', this.orientation);
    if (this.props.className) this.el.className = this.props.className as string;

    // Step list
    const stepList = document.createElement('div');
    stepList.setAttribute('data-part', 'step-list');
    stepList.setAttribute('data-orientation', this.orientation);

    this.steps.forEach((step, index) => {
      const isCurrent = step.id === this.currentStep;
      const isFocused = this.focusIndex === index;
      const isActing = this.actingStepId === step.id && this.state === 'acting';
      const showConnector = index < this.steps.length - 1;

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-part', 'step-wrapper');

      // Step element
      const stepEl = document.createElement('div');
      stepEl.setAttribute('data-part', 'step');
      stepEl.setAttribute('role', 'listitem');
      if (isCurrent) stepEl.setAttribute('aria-current', 'step');
      stepEl.setAttribute('aria-label', `Step ${index + 1}: ${step.label} \u2014 ${step.status}`);
      stepEl.setAttribute('data-status', step.status);
      stepEl.setAttribute('data-current', isCurrent ? 'true' : 'false');
      stepEl.setAttribute('tabindex', isFocused ? '0' : '-1');

      const onClick = () => this.handleFocusStep(step.id, index);
      const onDblClick = () => { if (isCurrent || step.status === 'active') this.handleStartAction(step.id); };
      stepEl.addEventListener('click', onClick);
      stepEl.addEventListener('dblclick', onDblClick);
      this.disposers.push(() => stepEl.removeEventListener('click', onClick), () => stepEl.removeEventListener('dblclick', onDblClick));

      // Step indicator
      const indicator = document.createElement('div');
      indicator.setAttribute('data-part', 'step-indicator');
      indicator.setAttribute('data-index', String(index + 1));
      indicator.setAttribute('data-status', step.status);
      indicator.setAttribute('aria-hidden', 'true');
      const indicatorSpan = document.createElement('span');
      indicatorSpan.textContent = (step.status === 'pending' || step.status === 'active') ? String(index + 1) : stepStatusIcon(step.status);
      indicator.appendChild(indicatorSpan);
      stepEl.appendChild(indicator);

      // Label
      const label = document.createElement('span');
      label.setAttribute('data-part', 'step-label');
      label.textContent = step.label;
      stepEl.appendChild(label);

      // Assignee
      if (showAssignee && step.approver) {
        const assignee = document.createElement('div');
        assignee.setAttribute('data-part', 'step-assignee');
        assignee.setAttribute('data-visible', 'true');
        const nameSpan = document.createElement('span');
        nameSpan.setAttribute('data-part', 'assignee-name');
        nameSpan.textContent = step.approver;
        assignee.appendChild(nameSpan);
        stepEl.appendChild(assignee);
      }

      // Status badge
      const statusDiv = document.createElement('div');
      statusDiv.setAttribute('data-part', 'step-status');
      statusDiv.setAttribute('data-status', step.status);
      const statusSpan = document.createElement('span');
      statusSpan.textContent = step.status;
      statusDiv.appendChild(statusSpan);
      stepEl.appendChild(statusDiv);

      // Quorum display
      if (this.variant !== 'sequential' && step.quorumRequired) {
        const quorum = document.createElement('div');
        quorum.setAttribute('data-part', 'quorum-display');
        quorum.setAttribute('aria-label', `${step.quorumCurrent ?? 0} of ${step.quorumRequired} approvals`);
        const qCount = document.createElement('span');
        qCount.setAttribute('data-part', 'quorum-count');
        qCount.textContent = `${step.quorumCurrent ?? 0}/${step.quorumRequired}`;
        quorum.appendChild(qCount);
        stepEl.appendChild(quorum);
      }

      // Timestamp
      if (step.timestamp) {
        const ts = document.createElement('span');
        ts.setAttribute('data-part', 'step-timestamp');
        ts.textContent = step.timestamp;
        stepEl.appendChild(ts);
      }

      wrapper.appendChild(stepEl);

      // Action bar
      if (isActing) {
        const actionBar = document.createElement('div');
        actionBar.setAttribute('data-part', 'action-bar');
        actionBar.setAttribute('role', 'toolbar');
        actionBar.setAttribute('aria-label', 'Approval actions');
        actionBar.setAttribute('data-visible', 'true');

        const approveBtn = document.createElement('button');
        approveBtn.setAttribute('type', 'button');
        approveBtn.setAttribute('data-part', 'approve-button');
        approveBtn.setAttribute('aria-label', `Approve step: ${step.label}`);
        approveBtn.textContent = 'Approve';
        const onApprove = () => this.handleApprove(step.id);
        approveBtn.addEventListener('click', onApprove);
        this.disposers.push(() => approveBtn.removeEventListener('click', onApprove));
        actionBar.appendChild(approveBtn);

        const rejectBtn = document.createElement('button');
        rejectBtn.setAttribute('type', 'button');
        rejectBtn.setAttribute('data-part', 'reject-button');
        rejectBtn.setAttribute('aria-label', `Reject step: ${step.label}`);
        rejectBtn.textContent = 'Reject';
        const onReject = () => this.handleReject(step.id);
        rejectBtn.addEventListener('click', onReject);
        this.disposers.push(() => rejectBtn.removeEventListener('click', onReject));
        actionBar.appendChild(rejectBtn);

        const delegateBtn = document.createElement('button');
        delegateBtn.setAttribute('type', 'button');
        delegateBtn.setAttribute('data-part', 'delegate-button');
        delegateBtn.setAttribute('aria-label', `Delegate step: ${step.label}`);
        delegateBtn.textContent = 'Delegate';
        const onDelegate = () => this.handleDelegate(step.id);
        delegateBtn.addEventListener('click', onDelegate);
        this.disposers.push(() => delegateBtn.removeEventListener('click', onDelegate));
        actionBar.appendChild(delegateBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('type', 'button');
        cancelBtn.setAttribute('data-part', 'cancel-action-button');
        cancelBtn.setAttribute('aria-label', 'Cancel');
        cancelBtn.textContent = 'Cancel';
        const onCancel = () => this.handleCancelAction();
        cancelBtn.addEventListener('click', onCancel);
        this.disposers.push(() => cancelBtn.removeEventListener('click', onCancel));
        actionBar.appendChild(cancelBtn);

        wrapper.appendChild(actionBar);
      }

      // Connector
      if (showConnector) {
        const connector = document.createElement('div');
        connector.setAttribute('data-part', 'connector');
        connector.setAttribute('data-orientation', this.orientation);
        connector.setAttribute('data-status', connectorStatus(step.status));
        connector.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(connector);
      }

      stepList.appendChild(wrapper);
    });
    this.el.appendChild(stepList);

    // SLA indicator
    if (showSLA && dueAt) {
      const sla = document.createElement('div');
      sla.setAttribute('data-part', 'sla-indicator');
      sla.setAttribute('role', 'timer');
      sla.setAttribute('aria-label', 'Time remaining');
      sla.setAttribute('data-visible', 'true');
      sla.setAttribute('data-due', dueAt);
      sla.setAttribute('data-overdue', new Date(dueAt).getTime() < Date.now() ? 'true' : 'false');
      const slaLabel = document.createElement('span');
      slaLabel.setAttribute('data-part', 'sla-label');
      slaLabel.textContent = 'SLA: ';
      sla.appendChild(slaLabel);
      const slaCountdown = document.createElement('span');
      slaCountdown.setAttribute('data-part', 'sla-countdown');
      slaCountdown.textContent = formatTimeRemaining(dueAt);
      sla.appendChild(slaCountdown);
      this.el.appendChild(sla);
    }
  }
}

export default ApprovalStepper;
