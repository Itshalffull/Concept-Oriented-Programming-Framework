import { defineComponent, h, ref, watch, computed, type PropType } from 'vue';

export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'STREAM_START' }
  | { type: 'COLLAPSE' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'expanded';
      return state;
    default:
      return state;
  }
}

export const ReasoningBlock = defineComponent({
  name: 'ReasoningBlock',
  props: {
    content: { type: String, required: true },
    collapsed: { type: Boolean, required: true },
    defaultExpanded: { type: Boolean, default: false },
    showDuration: { type: Boolean, default: true },
    streaming: { type: Boolean, default: false },
    duration: { type: Number, default: undefined },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    const state = ref<ReasoningBlockState>(
      props.streaming ? 'streaming' : props.defaultExpanded ? 'expanded' : 'collapsed'
    );

    function send(event: ReasoningBlockEvent) {
      state.value = reasoningBlockReducer(state.value, event);
    }

    watch(() => props.streaming, (val, old) => {
      if (val && !old) send({ type: 'STREAM_START' });
      if (!val && old) send({ type: 'STREAM_END' });
    });

    watch(() => props.content, () => {
      if (state.value === 'streaming') send({ type: 'TOKEN' });
    });

    const isOpen = computed(() => state.value === 'expanded' || state.value === 'streaming');
    const summary = computed(() => {
      if (props.streaming) return 'Thinking...';
      if (props.content.length > 60) return props.content.slice(0, 60) + '...';
      return props.content;
    });

    function handleToggle() {
      if (state.value === 'streaming') return;
      send({ type: isOpen.value ? 'COLLAPSE' : 'EXPAND' });
      emit('toggle', !isOpen.value);
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', {
        'data-part': 'header',
        onClick: handleToggle,
        style: { cursor: 'pointer' },
        role: 'button',
        'aria-expanded': isOpen.value ? 'true' : 'false',
      }, [
        h('div', { 'data-part': 'header-icon', 'aria-hidden': 'true' }, '\u{1F9E0}'),
        h('span', { 'data-part': 'header-text' }, state.value === 'streaming' ? 'Thinking...' : summary.value),
        h('span', { 'data-part': 'expand-icon', 'aria-hidden': 'true' }, isOpen.value ? '\u25BC' : '\u25B6'),
      ]));

      // Body
      if (isOpen.value) {
        children.push(h('div', {
          'data-part': 'body',
          role: 'region',
          'aria-label': 'Reasoning content',
        }, [
          h('div', { style: { whiteSpace: 'pre-wrap' } }, props.content),
          state.value === 'streaming' ? h('span', {
            'data-part': 'streaming-cursor',
            'aria-hidden': 'true',
            style: { display: 'inline-block', width: '2px', height: '1em', backgroundColor: 'currentColor', animation: 'clef-cursor-blink 1s step-end infinite' },
          }) : null,
        ]));
      }

      // Duration
      if (props.showDuration && props.duration != null && state.value !== 'streaming') {
        children.push(h('span', { 'data-part': 'duration' }, `${props.duration}ms`));
      }

      return h('div', {
        role: 'group',
        'aria-label': 'Reasoning block',
        'data-surface-widget': '',
        'data-widget-name': 'reasoning-block',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ReasoningBlock;
