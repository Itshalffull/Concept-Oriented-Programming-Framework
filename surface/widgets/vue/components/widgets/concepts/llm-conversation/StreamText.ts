import { defineComponent, h, ref, watch, computed, onMounted, type PropType } from 'vue';

export type StreamTextState = 'idle' | 'streaming' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'complete';
      if (event.type === 'STOP') return 'stopped';
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    default:
      return state;
  }
}

export const StreamText = defineComponent({
  name: 'StreamText',
  props: {
    content: { type: String, required: true },
    streaming: { type: Boolean, required: true },
    renderMarkdown: { type: Boolean, default: true },
    cursorStyle: { type: String as PropType<'bar' | 'block' | 'underline'>, default: 'bar' },
    smoothScroll: { type: Boolean, default: true },
  },
  emits: ['stop'],
  setup(props, { emit }) {
    const state = ref<StreamTextState>(props.streaming ? 'streaming' : 'idle');
    const scrollRef = ref<HTMLElement | null>(null);
    const prevStreaming = ref(props.streaming);

    function send(event: StreamTextEvent) {
      state.value = streamTextReducer(state.value, event);
    }

    watch(() => props.streaming, (val) => {
      const was = prevStreaming.value;
      prevStreaming.value = val;
      if (val && !was) send({ type: 'STREAM_START' });
      else if (!val && was) send({ type: 'STREAM_END' });
    });

    watch(() => props.content, () => {
      if (state.value === 'streaming') send({ type: 'TOKEN' });
    });

    watch([() => props.content, state], () => {
      if (state.value !== 'streaming') return;
      const el = scrollRef.value;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: props.smoothScroll ? 'smooth' : 'auto' });
    });

    function handleStop() {
      if (state.value !== 'streaming') return;
      send({ type: 'STOP' });
      emit('stop');
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); handleStop(); }
    }

    const isStreaming = computed(() => state.value === 'streaming');

    const cursorStyles = computed(() => {
      const base = { display: 'inline-block', animation: 'clef-cursor-blink 1s step-end infinite' };
      if (props.cursorStyle === 'block') return { ...base, width: '0.6em', height: '1.2em', verticalAlign: 'text-bottom', backgroundColor: 'currentColor', opacity: 0.7 };
      if (props.cursorStyle === 'underline') return { ...base, width: '0.6em', height: '2px', verticalAlign: 'baseline', backgroundColor: 'currentColor' };
      return { ...base, width: '2px', height: '1.2em', verticalAlign: 'text-bottom', backgroundColor: 'currentColor' };
    });

    return () => {
      const textChildren: any[] = [];
      if (props.renderMarkdown) {
        textChildren.push(h('div', { innerHTML: props.content }));
      } else {
        textChildren.push(h('span', { style: { whiteSpace: 'pre-wrap' } }, props.content));
      }
      if (isStreaming.value) {
        textChildren.push(h('span', {
          'data-part': 'cursor',
          'data-style': props.cursorStyle,
          'data-visible': 'true',
          'data-state': state.value,
          'aria-hidden': 'true',
          style: cursorStyles.value,
        }));
      }

      const children: any[] = [
        h('div', {
          ref: (el: any) => { scrollRef.value = el; },
          'data-part': 'text-block',
          'data-state': state.value,
          'data-markdown': props.renderMarkdown ? 'true' : 'false',
          style: { overflow: 'auto' },
        }, textChildren),
      ];

      if (isStreaming.value) {
        children.push(h('button', {
          type: 'button',
          'data-part': 'stop-button',
          'data-state': state.value,
          'data-visible': 'true',
          role: 'button',
          'aria-label': 'Stop generation',
          tabindex: 0,
          onClick: handleStop,
        }, 'Stop'));
      }

      return h('div', {
        role: 'region',
        'aria-label': 'Streaming response',
        'aria-live': 'polite',
        'aria-busy': isStreaming.value ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'stream-text',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default StreamText;
