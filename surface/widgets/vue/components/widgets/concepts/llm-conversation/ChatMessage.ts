import { defineComponent, h, ref, watch, onBeforeUnmount, computed, type PropType } from 'vue';

export type ChatMessageState = 'idle' | 'hovered' | 'streaming' | 'copied';
export type ChatMessageEvent =
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' }
  | { type: 'COPY' }
  | { type: 'COPY_TIMEOUT' };

export function chatMessageReducer(state: ChatMessageState, event: ChatMessageEvent): ChatMessageState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STREAM_START') return 'streaming';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'STREAM_END') return 'idle';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'idle';
      return state;
    default:
      return state;
  }
}

const ROLE_AVATARS: Record<string, string> = {
  user: '\u{1F464}',
  assistant: '\u{1F916}',
  system: '\u2699\uFE0F',
  tool: '\u{1F527}',
};

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
};

export const ChatMessage = defineComponent({
  name: 'ChatMessage',
  props: {
    role: { type: String as PropType<'user' | 'assistant' | 'system' | 'tool'>, required: true },
    content: { type: String, required: true },
    timestamp: { type: String, required: true },
    variant: { type: String as PropType<'default' | 'compact' | 'bubble'>, default: 'default' },
    showAvatar: { type: Boolean, default: true },
    showTimestamp: { type: Boolean, default: true },
    isStreaming: { type: Boolean, default: false },
  },
  emits: ['copy', 'regenerate', 'edit'],
  setup(props, { emit, slots }) {
    const state = ref<ChatMessageState>(props.isStreaming ? 'streaming' : 'idle');
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    function send(event: ChatMessageEvent) {
      state.value = chatMessageReducer(state.value, event);
    }

    watch(() => props.isStreaming, (val) => {
      send({ type: val ? 'STREAM_START' : 'STREAM_END' });
    });

    watch(state, (s) => {
      if (s === 'copied') {
        copyTimer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      }
    });

    onBeforeUnmount(() => {
      if (copyTimer) clearTimeout(copyTimer);
    });

    async function handleCopy() {
      try { await navigator.clipboard.writeText(props.content); } catch { /* noop */ }
      send({ type: 'COPY' });
      emit('copy');
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'c') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          handleCopy();
        }
      }
    }

    const roleLabel = computed(() => ROLE_LABELS[props.role] ?? props.role);
    const actionsVisible = computed(() => state.value === 'hovered' && !props.isStreaming);

    return () => {
      const children: any[] = [];

      // Avatar
      children.push(h('div', {
        'data-part': 'avatar',
        'data-role': props.role,
        'data-visible': props.showAvatar ? 'true' : 'false',
        'aria-hidden': 'true',
      }, props.showAvatar ? (ROLE_AVATARS[props.role] ?? props.role.charAt(0).toUpperCase()) : null));

      // Role label
      children.push(h('span', { 'data-part': 'role-label' }, roleLabel.value));

      // Body
      const bodyChildren: any[] = [];
      if (slots.default) {
        bodyChildren.push(slots.default());
      } else {
        bodyChildren.push(props.content);
      }
      if (props.isStreaming) {
        bodyChildren.push(h('span', {
          'data-part': 'streaming-cursor',
          'aria-hidden': 'true',
          style: {
            display: 'inline-block',
            width: '2px',
            height: '1em',
            backgroundColor: 'currentColor',
            marginLeft: '2px',
            verticalAlign: 'text-bottom',
            animation: 'chat-message-blink 1s step-end infinite',
          },
        }));
      }
      children.push(h('div', {
        'data-part': 'body',
        'data-role': props.role,
        role: 'region',
        'aria-label': 'Message content',
      }, bodyChildren));

      // Timestamp
      children.push(h('span', {
        'data-part': 'timestamp',
        'data-visible': props.showTimestamp ? 'true' : 'false',
      }, props.showTimestamp ? props.timestamp : null));

      // Actions toolbar
      const actionButtons: any[] = [];
      actionButtons.push(h('button', {
        type: 'button',
        'data-part': 'copy-button',
        'data-state': state.value === 'copied' ? 'copied' : 'idle',
        'aria-label': state.value === 'copied' ? 'Copied to clipboard' : 'Copy message',
        'aria-live': 'polite',
        tabindex: 0,
        onClick: handleCopy,
      }, state.value === 'copied' ? 'Copied!' : 'Copy'));

      if (props.role === 'assistant') {
        actionButtons.push(h('button', {
          type: 'button',
          'data-part': 'regenerate-button',
          'aria-label': 'Regenerate message',
          tabindex: 0,
          onClick: () => emit('regenerate'),
        }, 'Regenerate'));
      }

      if (props.role === 'user') {
        actionButtons.push(h('button', {
          type: 'button',
          'data-part': 'edit-button',
          'aria-label': 'Edit message',
          tabindex: 0,
          onClick: () => emit('edit'),
        }, 'Edit'));
      }

      children.push(h('div', {
        'data-part': 'actions',
        'data-visible': actionsVisible.value ? 'true' : 'false',
        role: 'toolbar',
        'aria-label': 'Message actions',
        style: {
          visibility: actionsVisible.value ? 'visible' : 'hidden',
          position: actionsVisible.value ? 'relative' : 'absolute',
          pointerEvents: actionsVisible.value ? 'auto' : 'none',
        },
      }, actionButtons));

      if (props.isStreaming) {
        children.push(h('style', {}, `
          @keyframes chat-message-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `));
      }

      return h('article', {
        role: 'article',
        'aria-label': `${roleLabel.value} message`,
        'data-surface-widget': '',
        'data-widget-name': 'chat-message',
        'data-part': 'root',
        'data-state': state.value,
        'data-role': props.role,
        'data-variant': props.variant,
        'data-streaming': props.isStreaming ? 'true' : 'false',
        tabindex: 0,
        onMouseenter: () => send({ type: 'HOVER' }),
        onMouseleave: () => send({ type: 'LEAVE' }),
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ChatMessage;
