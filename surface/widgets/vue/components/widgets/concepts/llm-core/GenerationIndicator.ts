import { defineComponent, h, ref, watch, computed, onMounted, onBeforeUnmount, type PropType } from 'vue';

export type GenerationIndicatorState = 'idle' | 'generating' | 'complete' | 'error';
export type GenerationIndicatorEvent =
  | { type: 'START' }
  | { type: 'TOKEN' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function generationIndicatorReducer(state: GenerationIndicatorState, event: GenerationIndicatorEvent): GenerationIndicatorState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'generating';
      return state;
    case 'generating':
      if (event.type === 'TOKEN') return 'generating';
      if (event.type === 'COMPLETE') return 'complete';
      if (event.type === 'ERROR') return 'error';
      return state;
    case 'complete':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'START') return 'generating';
      return state;
    case 'error':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'generating';
      return state;
    default:
      return state;
  }
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready', generating: 'Generating...', complete: 'Complete', error: 'Error',
};

export const GenerationIndicator = defineComponent({
  name: 'GenerationIndicator',
  props: {
    status: { type: String as PropType<'idle' | 'generating' | 'complete' | 'error'>, required: true },
    model: { type: String, default: undefined },
    tokenCount: { type: Number, default: undefined },
    showTokens: { type: Boolean, default: true },
    showModel: { type: Boolean, default: true },
    showElapsed: { type: Boolean, default: true },
    variant: { type: String as PropType<'dots' | 'spinner' | 'bar'>, default: 'dots' },
  },
  emits: ['retry', 'reset'],
  setup(props, { emit }) {
    const state = ref<GenerationIndicatorState>(props.status as GenerationIndicatorState);
    const elapsed = ref(0);
    let startTime = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    function send(event: GenerationIndicatorEvent) {
      state.value = generationIndicatorReducer(state.value, event);
    }

    watch(() => props.status, (s) => {
      const map: Record<string, GenerationIndicatorEvent> = {
        generating: { type: 'START' }, complete: { type: 'COMPLETE' },
        error: { type: 'ERROR' }, idle: { type: 'RESET' },
      };
      if (map[s]) send(map[s]);
    });

    watch(state, (s) => {
      if (s === 'generating') {
        startTime = Date.now();
        elapsed.value = 0;
        timer = setInterval(() => { elapsed.value = Date.now() - startTime; }, 100);
      } else {
        if (timer) { clearInterval(timer); timer = undefined; }
      }
    }, { immediate: true });

    watch(() => props.tokenCount, () => {
      if (state.value === 'generating') send({ type: 'TOKEN' });
    });

    onBeforeUnmount(() => { if (timer) clearInterval(timer); });

    const elapsedStr = computed(() => {
      const s = Math.floor(elapsed.value / 1000);
      const ms = elapsed.value % 1000;
      return s > 0 ? `${s}.${Math.floor(ms / 100)}s` : `${ms}ms`;
    });

    const isGenerating = computed(() => state.value === 'generating');

    return () => {
      const children: any[] = [];

      // Spinner
      if (isGenerating.value) {
        children.push(h('div', {
          'data-part': 'spinner', 'data-variant': props.variant, 'aria-hidden': 'true',
        }, props.variant === 'dots' ? '\u2022\u2022\u2022' : ''));
      }

      // Status text
      children.push(h('span', {
        'data-part': 'status-text', role: 'status', 'aria-live': 'polite',
      }, STATUS_LABELS[state.value] ?? state.value));

      // Model badge
      if (props.showModel && props.model) {
        children.push(h('div', { 'data-part': 'model-badge' }, props.model));
      }

      // Token counter
      if (props.showTokens && props.tokenCount != null) {
        children.push(h('span', {
          'data-part': 'token-counter', role: 'status', 'aria-live': 'polite', 'data-visible': 'true',
        }, `${props.tokenCount} tokens`));
      }

      // Elapsed
      if (props.showElapsed && (isGenerating.value || state.value === 'complete')) {
        children.push(h('span', { 'data-part': 'elapsed', 'data-visible': 'true' }, elapsedStr.value));
      }

      // Error retry
      if (state.value === 'error') {
        children.push(h('button', {
          type: 'button', 'data-part': 'retry-button',
          'aria-label': 'Retry generation',
          onClick: () => { send({ type: 'RETRY' }); emit('retry'); },
        }, 'Retry'));
      }

      return h('div', {
        role: 'status',
        'aria-label': `Generation: ${STATUS_LABELS[state.value]}`,
        'data-surface-widget': '',
        'data-widget-name': 'generation-indicator',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
      }, children);
    };
  },
});

export default GenerationIndicator;
