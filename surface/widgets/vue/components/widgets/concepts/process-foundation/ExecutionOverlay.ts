import { defineComponent, h, ref, computed, watch, onBeforeUnmount, type PropType } from 'vue';

export type ExecutionOverlayState = 'idle' | 'live' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'replay';
export type ExecutionOverlayEvent =
  | { type: 'START' }
  | { type: 'LOAD_REPLAY' }
  | { type: 'STEP_ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'FAIL' }
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

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready', live: 'Running', suspended: 'Suspended', completed: 'Completed',
  failed: 'Failed', cancelled: 'Cancelled', replay: 'Replaying',
};

export const ExecutionOverlay = defineComponent({
  name: 'ExecutionOverlay',
  props: {
    status: { type: String, required: true },
    activeStep: { type: String, default: undefined },
    startedAt: { type: String, default: undefined },
    endedAt: { type: String, default: undefined },
    mode: { type: String as PropType<'live' | 'replay'>, default: 'live' },
    showControls: { type: Boolean, default: true },
    showElapsed: { type: Boolean, default: true },
    animateFlow: { type: Boolean, default: true },
    errorMessage: { type: String, default: undefined },
  },
  emits: ['suspend', 'resume', 'cancel', 'retry', 'reset'],
  setup(props, { emit, slots }) {
    const state = ref<ExecutionOverlayState>('idle');
    const elapsed = ref(0);
    let timer: ReturnType<typeof setInterval> | undefined;

    function send(event: ExecutionOverlayEvent) {
      state.value = executionOverlayReducer(state.value, event);
    }

    watch(() => props.status, (s) => {
      const map: Record<string, ExecutionOverlayEvent> = {
        running: { type: 'START' }, live: { type: 'START' }, completed: { type: 'COMPLETE' },
        failed: { type: 'FAIL' }, suspended: { type: 'SUSPEND' }, cancelled: { type: 'CANCEL' },
        idle: { type: 'RESET' }, replay: { type: 'LOAD_REPLAY' },
      };
      if (map[s]) send(map[s]);
    }, { immediate: true });

    watch(state, (s) => {
      if (s === 'live') {
        const start = props.startedAt ? new Date(props.startedAt).getTime() : Date.now();
        elapsed.value = Date.now() - start;
        timer = setInterval(() => { elapsed.value = Date.now() - start; }, 100);
      } else {
        if (timer) { clearInterval(timer); timer = undefined; }
      }
    });

    onBeforeUnmount(() => { if (timer) clearInterval(timer); });

    const elapsedStr = computed(() => {
      const s = Math.floor(elapsed.value / 1000);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    });

    const isRunning = computed(() => state.value === 'live' || state.value === 'replay');

    return () => {
      const children: any[] = [];

      // Active step highlight
      if (props.activeStep && isRunning.value) {
        children.push(h('div', {
          'data-part': 'active-marker', 'data-step': props.activeStep,
          'aria-label': `Active step: ${props.activeStep}`,
        }, props.activeStep));
      }

      // Flow animation
      if (props.animateFlow && isRunning.value) {
        children.push(h('div', { 'data-part': 'flow-animation', 'aria-hidden': 'true' }));
      }

      // Status bar
      children.push(h('div', { 'data-part': 'status-bar' }, [
        h('span', { 'data-part': 'status-label', role: 'status' }, STATUS_LABELS[state.value] ?? state.value),
        props.showElapsed && (state.value === 'live' || state.value === 'completed' || state.value === 'failed')
          ? h('span', { 'data-part': 'elapsed-time' }, elapsedStr.value) : null,
      ]));

      // Controls
      if (props.showControls) {
        const controls: any[] = [];
        if (state.value === 'live') {
          controls.push(h('button', { type: 'button', 'data-part': 'suspend-button', 'aria-label': 'Suspend execution', onClick: () => { send({ type: 'SUSPEND' }); emit('suspend'); } }, 'Suspend'));
          controls.push(h('button', { type: 'button', 'data-part': 'cancel-button', 'aria-label': 'Cancel execution', onClick: () => { send({ type: 'CANCEL' }); emit('cancel'); } }, 'Cancel'));
        }
        if (state.value === 'suspended') {
          controls.push(h('button', { type: 'button', 'data-part': 'resume-button', 'aria-label': 'Resume execution', onClick: () => { send({ type: 'RESUME' }); emit('resume'); } }, 'Resume'));
          controls.push(h('button', { type: 'button', 'data-part': 'cancel-button', 'aria-label': 'Cancel execution', onClick: () => { send({ type: 'CANCEL' }); emit('cancel'); } }, 'Cancel'));
        }
        if (state.value === 'failed') {
          controls.push(h('button', { type: 'button', 'data-part': 'retry-button', 'aria-label': 'Retry', onClick: () => { send({ type: 'RETRY' }); emit('retry'); } }, 'Retry'));
          controls.push(h('button', { type: 'button', 'data-part': 'reset-button', 'aria-label': 'Reset', onClick: () => { send({ type: 'RESET' }); emit('reset'); } }, 'Reset'));
        }
        if (state.value === 'completed' || state.value === 'cancelled') {
          controls.push(h('button', { type: 'button', 'data-part': 'reset-button', 'aria-label': 'Reset', onClick: () => { send({ type: 'RESET' }); emit('reset'); } }, 'Reset'));
        }
        if (controls.length > 0) {
          children.push(h('div', { 'data-part': 'control-buttons', role: 'toolbar', 'aria-label': 'Execution controls' }, controls));
        }
      }

      // Error banner
      if (state.value === 'failed' && props.errorMessage) {
        children.push(h('div', { 'data-part': 'error-banner', role: 'alert' }, props.errorMessage));
      }

      // Slot content
      if (slots.default) children.push(slots.default());

      return h('div', {
        role: 'group',
        'aria-label': `Execution: ${STATUS_LABELS[state.value]}`,
        'data-surface-widget': '',
        'data-widget-name': 'execution-overlay',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
      }, children);
    };
  },
});

export default ExecutionOverlay;
