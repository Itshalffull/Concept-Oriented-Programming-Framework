import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

function formatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

export const ToolCallDetail = defineComponent({
  name: 'ToolCallDetail',
  props: {
    toolName: { type: String, required: true },
    arguments: { type: String, required: true },
    result: { type: String, default: undefined },
    timing: { type: Number, default: undefined },
    tokenUsage: { type: Number, default: undefined },
    error: { type: String, default: undefined },
    showTiming: { type: Boolean, default: true },
    showTokens: { type: Boolean, default: true },
  },
  emits: ['retry'],
  setup(props, { emit }) {
    const state = ref<ToolCallDetailState>('idle');
    const argsExpanded = ref(true);
    const resultExpanded = ref(true);

    function send(event: ToolCallDetailEvent) {
      state.value = toolCallDetailReducer(state.value, event);
    }

    const hasError = computed(() => !!props.error);
    const statusLabel = computed(() => {
      if (state.value === 'retrying') return 'Retrying...';
      if (hasError.value) return 'Error';
      if (props.result != null) return 'Success';
      return 'Pending';
    });

    function handleRetry() {
      send({ type: 'RETRY' });
      emit('retry');
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'r' && e.ctrlKey) { e.preventDefault(); handleRetry(); }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', { 'data-part': 'header' }, [
        h('span', { 'data-part': 'tool-name' }, props.toolName),
        h('div', { 'data-part': 'status-badge', 'data-status': hasError.value ? 'error' : 'success' }, statusLabel.value),
      ]));

      // Arguments panel
      children.push(h('div', { 'data-part': 'arguments-panel' }, [
        h('button', {
          type: 'button', 'data-part': 'section-toggle',
          'aria-expanded': argsExpanded.value ? 'true' : 'false',
          onClick: () => { argsExpanded.value = !argsExpanded.value; send({ type: 'EXPAND_ARGS' }); },
        }, `${argsExpanded.value ? '\u25BC' : '\u25B6'} Arguments`),
        argsExpanded.value ? h('pre', { 'data-part': 'arguments-json' }, formatJson(props.arguments)) : null,
      ]));

      // Result panel
      if (props.result != null) {
        children.push(h('div', { 'data-part': 'result-panel' }, [
          h('button', {
            type: 'button', 'data-part': 'section-toggle',
            'aria-expanded': resultExpanded.value ? 'true' : 'false',
            onClick: () => { resultExpanded.value = !resultExpanded.value; send({ type: 'EXPAND_RESULT' }); },
          }, `${resultExpanded.value ? '\u25BC' : '\u25B6'} Result`),
          resultExpanded.value ? h('pre', { 'data-part': 'result-json' }, formatJson(props.result)) : null,
        ]));
      }

      // Timing
      if (props.showTiming && props.timing != null) {
        children.push(h('div', { 'data-part': 'timing-bar' }, [
          h('span', { 'data-part': 'timing-label' }, 'Duration'),
          h('span', { 'data-part': 'timing-value' }, `${props.timing}ms`),
        ]));
      }

      // Token badge
      if (props.showTokens && props.tokenUsage != null) {
        children.push(h('div', { 'data-part': 'token-badge' }, `${props.tokenUsage} tokens`));
      }

      // Error panel
      if (hasError.value) {
        children.push(h('div', { 'data-part': 'error-panel', role: 'alert' }, props.error));
      }

      // Retry button
      if (hasError.value) {
        children.push(h('button', {
          type: 'button', 'data-part': 'retry-button',
          disabled: state.value === 'retrying',
          'aria-label': 'Retry tool call',
          onClick: handleRetry,
        }, state.value === 'retrying' ? 'Retrying...' : 'Retry'));
      }

      return h('div', {
        role: 'article',
        'aria-label': `Tool call: ${props.toolName}`,
        'data-surface-widget': '',
        'data-widget-name': 'tool-call-detail',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ToolCallDetail;
