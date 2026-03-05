import { defineComponent, h, ref, watch, computed, onBeforeUnmount, type PropType } from 'vue';

export type HitlInterruptState = 'pending' | 'approved' | 'denied' | 'requestingInfo';
export type HitlInterruptEvent =
  | { type: 'APPROVE' }
  | { type: 'DENY' }
  | { type: 'REQUEST_INFO' }
  | { type: 'CANCEL' }
  | { type: 'TICK' };

export function hitlInterruptReducer(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState {
  switch (state) {
    case 'pending':
      if (event.type === 'APPROVE') return 'approved';
      if (event.type === 'DENY') return 'denied';
      if (event.type === 'REQUEST_INFO') return 'requestingInfo';
      if (event.type === 'TICK') return 'pending';
      return state;
    case 'requestingInfo':
      if (event.type === 'CANCEL') return 'pending';
      return state;
    case 'approved':
    case 'denied':
      return state;
    default:
      return state;
  }
}

const RISK_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export const HitlInterrupt = defineComponent({
  name: 'HitlInterrupt',
  props: {
    action: { type: String, required: true },
    reason: { type: String, required: true },
    risk: { type: String as PropType<'low' | 'medium' | 'high' | 'critical'>, default: 'medium' },
    context: { type: String, default: '' },
    autoDenySeconds: { type: Number, default: 0 },
    status: { type: String, required: true },
  },
  emits: ['approve', 'deny', 'requestInfo'],
  setup(props, { emit }) {
    const state = ref<HitlInterruptState>('pending');
    const countdown = ref(props.autoDenySeconds);
    const infoText = ref('');
    let timer: ReturnType<typeof setInterval> | undefined;

    function send(event: HitlInterruptEvent) {
      state.value = hitlInterruptReducer(state.value, event);
    }

    if (props.autoDenySeconds > 0) {
      timer = setInterval(() => {
        if (state.value !== 'pending') { if (timer) clearInterval(timer); return; }
        countdown.value--;
        send({ type: 'TICK' });
        if (countdown.value <= 0) {
          send({ type: 'DENY' });
          emit('deny', 'auto-deny timeout');
          if (timer) clearInterval(timer);
        }
      }, 1000);
    }

    onBeforeUnmount(() => { if (timer) clearInterval(timer); });

    const isResolved = computed(() => state.value === 'approved' || state.value === 'denied');

    function handleKeydown(e: KeyboardEvent) {
      if (isResolved.value) return;
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); send({ type: 'APPROVE' }); emit('approve'); }
      if (e.key === 'Escape') { e.preventDefault(); if (state.value === 'requestingInfo') send({ type: 'CANCEL' }); else { send({ type: 'DENY' }); emit('deny', 'user dismissed'); } }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', { 'data-part': 'header' }, [
        h('span', { 'data-part': 'action-label' }, props.action),
        h('div', { 'data-part': 'risk-badge', 'data-risk': props.risk }, RISK_LABELS[props.risk] ?? props.risk),
      ]));

      // Reason
      children.push(h('div', { 'data-part': 'reason', role: 'alert' }, props.reason));

      // Context
      if (props.context) {
        children.push(h('div', { 'data-part': 'context' }, [
          h('div', { 'data-part': 'context-label' }, 'Context'),
          h('pre', { 'data-part': 'context-content' }, props.context),
        ]));
      }

      // Countdown
      if (props.autoDenySeconds > 0 && state.value === 'pending') {
        children.push(h('div', { 'data-part': 'countdown', role: 'timer' }, `Auto-deny in ${countdown.value}s`));
      }

      // Request info area
      if (state.value === 'requestingInfo') {
        children.push(h('div', { 'data-part': 'info-area' }, [
          h('textarea', {
            'data-part': 'info-textarea',
            'aria-label': 'Additional information',
            value: infoText.value,
            onInput: (e: Event) => { infoText.value = (e.target as HTMLTextAreaElement).value; },
            rows: 3,
          }),
          h('button', {
            type: 'button', 'data-part': 'send-info-button',
            onClick: () => { emit('requestInfo', infoText.value); send({ type: 'CANCEL' }); },
          }, 'Send'),
          h('button', {
            type: 'button', 'data-part': 'cancel-info-button',
            onClick: () => send({ type: 'CANCEL' }),
          }, 'Cancel'),
        ]));
      }

      // Action bar
      if (!isResolved.value && state.value !== 'requestingInfo') {
        children.push(h('div', { 'data-part': 'action-bar', role: 'toolbar', 'aria-label': 'Approval actions' }, [
          h('button', {
            type: 'button', 'data-part': 'approve-button',
            'aria-label': 'Approve action',
            onClick: () => { send({ type: 'APPROVE' }); emit('approve'); },
          }, 'Approve'),
          h('button', {
            type: 'button', 'data-part': 'deny-button',
            'aria-label': 'Deny action',
            onClick: () => { send({ type: 'DENY' }); emit('deny', 'user denied'); },
          }, 'Deny'),
          h('button', {
            type: 'button', 'data-part': 'request-info-button',
            'aria-label': 'Request more information',
            onClick: () => send({ type: 'REQUEST_INFO' }),
          }, 'Request Info'),
        ]));
      }

      // Resolved status
      if (isResolved.value) {
        children.push(h('div', {
          'data-part': 'resolved-status',
          'data-result': state.value,
          role: 'status',
        }, state.value === 'approved' ? '\u2713 Approved' : '\u2717 Denied'));
      }

      return h('div', {
        role: 'alertdialog',
        'aria-label': `Human approval required: ${props.action}`,
        'data-surface-widget': '',
        'data-widget-name': 'hitl-interrupt',
        'data-part': 'root',
        'data-state': state.value,
        'data-risk': props.risk,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default HitlInterrupt;
