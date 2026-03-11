import { defineComponent, h, ref, computed, type PropType } from 'vue';

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

interface ApprovalStep {
  id: string;
  label: string;
  approver?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'active';
  timestamp?: string;
  quorumRequired?: number;
  quorumCurrent?: number;
}

function stepStatusIcon(status: string): string {
  switch (status) { case 'approved': return '\u2713'; case 'rejected': return '\u2717'; case 'skipped': return '\u2014'; case 'active': return '\u25CF'; default: return '\u25CB'; }
}

function connectorStatus(prevStatus: string): string {
  switch (prevStatus) { case 'approved': return 'complete'; case 'rejected': return 'rejected'; case 'active': return 'active'; default: return 'pending'; }
}

function formatTimeRemaining(dueAt: string): string {
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const ApprovalStepper = defineComponent({
  name: 'ApprovalStepper',
  props: {
    steps: { type: Array as PropType<ApprovalStep[]>, required: true },
    currentStep: { type: String, required: true },
    status: { type: String, required: true },
    assignee: { type: String, default: undefined },
    dueAt: { type: String, default: undefined },
    variant: { type: String as PropType<'sequential' | 'parallel' | 'mixed'>, default: 'sequential' },
    orientation: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
    showSLA: { type: Boolean, default: true },
    showAssignee: { type: Boolean, default: true },
  },
  emits: ['approve', 'reject', 'delegate', 'claim'],
  setup(props, { emit, slots }) {
    const state = ref<ApprovalStepperState>('viewing');
    const focusIndex = ref(0);
    const actingStepId = ref<string | null>(null);

    function send(event: ApprovalStepperEvent) {
      state.value = approvalStepperReducer(state.value, event);
    }

    function handleFocusStep(id: string, index: number) {
      focusIndex.value = index;
      send({ type: 'FOCUS_STEP', id });
    }

    function handleStartAction(stepId: string) {
      actingStepId.value = stepId;
      send({ type: 'START_ACTION' });
    }

    function handleApprove(stepId: string) {
      emit('approve', stepId);
      send({ type: 'COMPLETE' });
      actingStepId.value = null;
    }

    function handleReject(stepId: string) {
      emit('reject', stepId);
      send({ type: 'COMPLETE' });
      actingStepId.value = null;
    }

    function handleDelegate(stepId: string) {
      emit('delegate', stepId);
      send({ type: 'COMPLETE' });
      actingStepId.value = null;
    }

    function handleCancelAction() {
      send({ type: 'CANCEL' });
      actingStepId.value = null;
    }

    function handleKeydown(e: KeyboardEvent) {
      const nextKey = props.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
      const prevKey = props.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
      if (e.key === nextKey || e.key === 'ArrowDown') { e.preventDefault(); const ni = Math.min(focusIndex.value + 1, props.steps.length - 1); handleFocusStep(props.steps[ni].id, ni); }
      if (e.key === prevKey || e.key === 'ArrowUp') { e.preventDefault(); const ni = Math.max(focusIndex.value - 1, 0); handleFocusStep(props.steps[ni].id, ni); }
      if (e.key === 'Enter') { e.preventDefault(); const step = props.steps[focusIndex.value]; if (step && (step.status === 'active' || step.id === props.currentStep)) handleStartAction(step.id); }
      if (e.key === 'Escape') { e.preventDefault(); handleCancelAction(); }
    }

    return () => {
      const children: any[] = [];

      // Step list
      const stepNodes = props.steps.map((step, index) => {
        const isCurrent = step.id === props.currentStep;
        const isFocused = focusIndex.value === index;
        const isActing = actingStepId.value === step.id && state.value === 'acting';
        const showConnector = index < props.steps.length - 1;

        const stepChildren: any[] = [];

        // Step node
        const nodeChildren: any[] = [
          h('div', { 'data-part': 'step-indicator', 'data-index': index + 1, 'data-status': step.status, 'aria-hidden': 'true' }, [
            h('span', {}, step.status === 'pending' || step.status === 'active' ? String(index + 1) : stepStatusIcon(step.status)),
          ]),
          h('span', { 'data-part': 'step-label' }, step.label),
        ];

        if (props.showAssignee && step.approver) {
          nodeChildren.push(h('div', { 'data-part': 'step-assignee', 'data-visible': 'true' }, [h('span', { 'data-part': 'assignee-name' }, step.approver)]));
        }

        nodeChildren.push(h('div', { 'data-part': 'step-status', 'data-status': step.status }, [h('span', {}, step.status)]));

        if (props.variant !== 'sequential' && step.quorumRequired) {
          nodeChildren.push(h('div', { 'data-part': 'quorum-display', 'aria-label': `${step.quorumCurrent ?? 0} of ${step.quorumRequired} approvals` }, [
            h('span', { 'data-part': 'quorum-count' }, `${step.quorumCurrent ?? 0}/${step.quorumRequired}`),
          ]));
        }

        if (step.timestamp) nodeChildren.push(h('span', { 'data-part': 'step-timestamp' }, step.timestamp));

        stepChildren.push(h('div', {
          'data-part': 'step', role: 'listitem',
          'aria-current': isCurrent ? 'step' : undefined,
          'aria-label': `Step ${index + 1}: ${step.label} \u2014 ${step.status}`,
          'data-status': step.status, 'data-current': isCurrent ? 'true' : 'false',
          tabindex: isFocused ? 0 : -1,
          onClick: () => handleFocusStep(step.id, index),
          onDblclick: () => { if (isCurrent || step.status === 'active') handleStartAction(step.id); },
        }, nodeChildren));

        // Action bar
        if (isActing) {
          stepChildren.push(h('div', { 'data-part': 'action-bar', role: 'toolbar', 'aria-label': 'Approval actions', 'data-visible': 'true' }, [
            h('button', { type: 'button', 'data-part': 'approve-button', onClick: () => handleApprove(step.id), 'aria-label': `Approve step: ${step.label}` }, 'Approve'),
            h('button', { type: 'button', 'data-part': 'reject-button', onClick: () => handleReject(step.id), 'aria-label': `Reject step: ${step.label}` }, 'Reject'),
            h('button', { type: 'button', 'data-part': 'delegate-button', onClick: () => handleDelegate(step.id), 'aria-label': `Delegate step: ${step.label}` }, 'Delegate'),
            h('button', { type: 'button', 'data-part': 'cancel-action-button', onClick: handleCancelAction, 'aria-label': 'Cancel' }, 'Cancel'),
          ]));
        }

        // Connector
        if (showConnector) {
          stepChildren.push(h('div', { 'data-part': 'connector', 'data-orientation': props.orientation, 'data-status': connectorStatus(step.status), 'aria-hidden': 'true' }));
        }

        return h('div', { key: step.id, 'data-part': 'step-wrapper' }, stepChildren);
      });

      children.push(h('div', { 'data-part': 'step-list', 'data-orientation': props.orientation }, stepNodes));

      // SLA
      if (props.showSLA && props.dueAt) {
        const overdue = new Date(props.dueAt).getTime() < Date.now();
        children.push(h('div', {
          'data-part': 'sla-indicator', role: 'timer', 'aria-label': 'Time remaining',
          'data-visible': 'true', 'data-due': props.dueAt, 'data-overdue': overdue ? 'true' : 'false',
        }, [
          h('span', { 'data-part': 'sla-label' }, 'SLA: '),
          h('span', { 'data-part': 'sla-countdown' }, formatTimeRemaining(props.dueAt)),
        ]));
      }

      if (slots.default) children.push(slots.default());

      return h('div', {
        role: 'list',
        'aria-label': 'Approval steps',
        'data-surface-widget': '',
        'data-widget-name': 'approval-stepper',
        'data-part': 'root',
        'data-variant': props.variant,
        'data-orientation': props.orientation,
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ApprovalStepper;
