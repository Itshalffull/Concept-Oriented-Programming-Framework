import { defineComponent, h, ref } from 'vue';

export type MessageActionsState = 'hidden' | 'visible' | 'copied';
export type MessageActionsEvent =
  | { type: 'SHOW' }
  | { type: 'HIDE' }
  | { type: 'COPY' }
  | { type: 'COPY_TIMEOUT' };

export function messageActionsReducer(state: MessageActionsState, event: MessageActionsEvent): MessageActionsState {
  switch (state) {
    case 'hidden':
      if (event.type === 'SHOW') return 'visible';
      return state;
    case 'visible':
      if (event.type === 'HIDE') return 'hidden';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'visible';
      return state;
    default:
      return state;
  }
}

export const MessageActions = defineComponent({
  name: 'MessageActions',
  props: {
    messageId: { type: String, required: true },
    showFeedback: { type: Boolean, default: true },
    showRegenerate: { type: Boolean, default: true },
    showEdit: { type: Boolean, default: true },
    showShare: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const state = ref<MessageActionsState>('hidden');
    function send(type: string) {
      state.value = messageActionsReducer(state.value, { type } as any);
    }

    return () => h('div', {
      role: 'toolbar',
      'aria-label': 'Hover-revealed toolbar for chat message actions including th',
      'data-surface-widget': '',
      'data-widget-name': 'message-actions',
      'data-part': 'root',
      'data-state': state.value,
      tabindex: 0,
    }, [
      h('button', { type: 'button', 'data-part': 'thumbs-up', 'data-state': state.value, onClick: () => send('SHOW') }, 'Positive feedback button'),
      h('button', { type: 'button', 'data-part': 'thumbs-down', 'data-state': state.value, onClick: () => send('SHOW') }, 'Negative feedback button'),
      h('button', { type: 'button', 'data-part': 'copy-button', 'data-state': state.value, onClick: () => send('SHOW') }, 'Copy message content'),
      h('button', { type: 'button', 'data-part': 'regenerate', 'data-state': state.value, onClick: () => send('SHOW') }, 'Regenerate this response'),
      h('button', { type: 'button', 'data-part': 'edit-button', 'data-state': state.value, onClick: () => send('SHOW') }, 'Edit this message'),
      h('button', { type: 'button', 'data-part': 'share-button', 'data-state': state.value, onClick: () => send('SHOW') }, 'Share this message'),
      h('button', { type: 'button', 'data-part': 'more-button', 'data-state': state.value, onClick: () => send('SHOW') }, 'Overflow menu for additional actions')
    ]);
  },
});

export default MessageActions;
