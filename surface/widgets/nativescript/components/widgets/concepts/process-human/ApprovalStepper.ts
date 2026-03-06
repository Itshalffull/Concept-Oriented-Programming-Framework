import {
  StackLayout,
  Label,
  Button,
} from '@nativescript/core';

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

export function createApprovalStepper(props: ApprovalStepperProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: ApprovalStepperState = 'viewing';
  let focusIndex = 0;
  let actingStepId: string | null = null;
  const variant = props.variant ?? 'sequential';
  const disposers: (() => void)[] = [];

  function send(event: ApprovalStepperEvent) {
    state = approvalStepperReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'approval-stepper';
  root.automationText = 'Approval steps';

  const stepList = new StackLayout();
  stepList.orientation = props.orientation === 'horizontal' ? 'horizontal' : 'vertical';
  root.addChild(stepList);

  const slaRow = new StackLayout();
  slaRow.orientation = 'horizontal';
  slaRow.marginTop = 8;
  root.addChild(slaRow);

  function update() {
    stepList.removeChildren();

    props.steps.forEach((step, index) => {
      const isCurrent = step.id === props.currentStep;
      const isActing = actingStepId === step.id && state === 'acting';

      const wrapper = new StackLayout();

      const stepItem = new StackLayout();
      stepItem.padding = 8;
      stepItem.marginBottom = 4;
      stepItem.borderWidth = isCurrent ? 2 : 1;
      stepItem.borderColor = isCurrent ? '#3b82f6' : '#e5e7eb';
      stepItem.borderRadius = 6;
      stepItem.className = `step step-${step.status}`;

      // Indicator
      const indicatorRow = new StackLayout();
      indicatorRow.orientation = 'horizontal';

      const indicatorLbl = new Label();
      indicatorLbl.text =
        step.status === 'pending' || step.status === 'active'
          ? String(index + 1)
          : stepStatusIcon(step.status);
      indicatorLbl.fontWeight = 'bold';
      indicatorLbl.width = 24;
      indicatorLbl.textAlignment = 'center';
      indicatorRow.addChild(indicatorLbl);

      const labelLbl = new Label();
      labelLbl.text = step.label;
      labelLbl.marginLeft = 8;
      indicatorRow.addChild(labelLbl);

      stepItem.addChild(indicatorRow);

      // Assignee
      if (props.showAssignee !== false && step.approver) {
        const approverLbl = new Label();
        approverLbl.text = step.approver;
        approverLbl.fontSize = 12;
        approverLbl.marginTop = 2;
        stepItem.addChild(approverLbl);
      }

      // Status badge
      const statusLbl = new Label();
      statusLbl.text = step.status;
      statusLbl.fontSize = 11;
      statusLbl.marginTop = 2;
      statusLbl.className = `step-status-${step.status}`;
      stepItem.addChild(statusLbl);

      // Quorum
      if (variant !== 'sequential' && step.quorumRequired) {
        const quorumLbl = new Label();
        quorumLbl.text = `${step.quorumCurrent ?? 0}/${step.quorumRequired}`;
        quorumLbl.fontSize = 12;
        quorumLbl.marginTop = 2;
        stepItem.addChild(quorumLbl);
      }

      // Timestamp
      if (step.timestamp) {
        const tsLbl = new Label();
        tsLbl.text = step.timestamp;
        tsLbl.fontSize = 11;
        tsLbl.marginTop = 2;
        stepItem.addChild(tsLbl);
      }

      stepItem.on('tap', () => {
        focusIndex = index;
        send({ type: 'FOCUS_STEP', id: step.id });
      });

      wrapper.addChild(stepItem);

      // Action bar
      if (isActing) {
        const actionBar = new StackLayout();
        actionBar.orientation = 'horizontal';
        actionBar.marginTop = 4;

        const approveBtn = new Button();
        approveBtn.text = 'Approve';
        approveBtn.on('tap', () => {
          props.onApprove?.(step.id);
          actingStepId = null;
          send({ type: 'COMPLETE' });
        });
        actionBar.addChild(approveBtn);

        const rejectBtn = new Button();
        rejectBtn.text = 'Reject';
        rejectBtn.marginLeft = 4;
        rejectBtn.on('tap', () => {
          props.onReject?.(step.id);
          actingStepId = null;
          send({ type: 'COMPLETE' });
        });
        actionBar.addChild(rejectBtn);

        const delegateBtn = new Button();
        delegateBtn.text = 'Delegate';
        delegateBtn.marginLeft = 4;
        delegateBtn.on('tap', () => {
          props.onDelegate?.(step.id);
          actingStepId = null;
          send({ type: 'COMPLETE' });
        });
        actionBar.addChild(delegateBtn);

        const cancelBtn = new Button();
        cancelBtn.text = 'Cancel';
        cancelBtn.marginLeft = 4;
        cancelBtn.on('tap', () => {
          actingStepId = null;
          send({ type: 'CANCEL' });
        });
        actionBar.addChild(cancelBtn);

        wrapper.addChild(actionBar);
      }

      // Connector line
      if (index < props.steps.length - 1) {
        const connector = new StackLayout();
        connector.height = 2;
        connector.marginTop = 2;
        connector.marginBottom = 2;
        connector.className = `connector connector-${step.status}`;
        if (step.status === 'approved') {
          connector.backgroundColor = '#22c55e';
        } else if (step.status === 'rejected') {
          connector.backgroundColor = '#ef4444';
        } else if (step.status === 'active') {
          connector.backgroundColor = '#3b82f6';
        } else {
          connector.backgroundColor = '#d1d5db';
        }
        wrapper.addChild(connector);
      }

      // Double-tap to start action (simulate with tap on current step)
      if (isCurrent || step.status === 'active') {
        stepItem.on('doubleTap', () => {
          actingStepId = step.id;
          send({ type: 'START_ACTION' });
        });
      }

      stepList.addChild(wrapper);
    });

    // SLA indicator
    slaRow.removeChildren();
    if (props.showSLA !== false && props.dueAt) {
      slaRow.visibility = 'visible';
      const slaLabel = new Label();
      slaLabel.text = 'SLA: ';
      slaLabel.fontWeight = 'bold';
      slaRow.addChild(slaLabel);

      const countdown = new Label();
      countdown.text = formatTimeRemaining(props.dueAt);
      const overdue = new Date(props.dueAt).getTime() < Date.now();
      countdown.color = (overdue ? '#dc2626' : '#16a34a') as any;
      slaRow.addChild(countdown);
    } else {
      slaRow.visibility = 'collapsed';
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createApprovalStepper;
