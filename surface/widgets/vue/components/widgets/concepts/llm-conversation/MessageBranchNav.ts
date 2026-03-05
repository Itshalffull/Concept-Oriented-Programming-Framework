import { defineComponent, h, ref, computed } from 'vue';

export type MessageBranchNavState = 'viewing' | 'editing';
export type MessageBranchNavEvent =
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'EDIT' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function messageBranchNavReducer(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState {
  switch (state) {
    case 'viewing':
      if (event.type === 'PREV') return 'viewing';
      if (event.type === 'NEXT') return 'viewing';
      if (event.type === 'EDIT') return 'editing';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

export const MessageBranchNav = defineComponent({
  name: 'MessageBranchNav',
  props: {
    currentIndex: { type: Number, required: true },
    totalBranches: { type: Number, required: true },
    showEdit: { type: Boolean, default: true },
    compact: { type: Boolean, default: false },
  },
  emits: ['prev', 'next', 'edit', 'save', 'cancel'],
  setup(props, { emit }) {
    const state = ref<MessageBranchNavState>('viewing');
    const editText = ref('');

    function send(event: MessageBranchNavEvent) {
      state.value = messageBranchNavReducer(state.value, event);
    }

    const hasPrev = computed(() => props.currentIndex > 0);
    const hasNext = computed(() => props.currentIndex < props.totalBranches - 1);

    function handlePrev() {
      if (!hasPrev.value) return;
      send({ type: 'PREV' });
      emit('prev');
    }

    function handleNext() {
      if (!hasNext.value) return;
      send({ type: 'NEXT' });
      emit('next');
    }

    function handleEdit() {
      send({ type: 'EDIT' });
      emit('edit');
    }

    function handleSave() {
      send({ type: 'SAVE' });
      emit('save', editText.value);
    }

    function handleCancel() {
      send({ type: 'CANCEL' });
      emit('cancel');
    }

    function handleKeydown(e: KeyboardEvent) {
      if (state.value === 'editing') {
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSave(); }
        if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); handleEdit(); }
    }

    return () => {
      const children: any[] = [];

      children.push(h('button', {
        type: 'button',
        'data-part': 'prev-button',
        'aria-label': 'Previous branch',
        disabled: !hasPrev.value,
        tabindex: 0,
        onClick: handlePrev,
      }, '\u2190'));

      children.push(h('span', {
        'data-part': 'indicator',
        role: 'status',
        'aria-label': `Branch ${props.currentIndex + 1} of ${props.totalBranches}`,
      }, `${props.currentIndex + 1} / ${props.totalBranches}`));

      children.push(h('button', {
        type: 'button',
        'data-part': 'next-button',
        'aria-label': 'Next branch',
        disabled: !hasNext.value,
        tabindex: 0,
        onClick: handleNext,
      }, '\u2192'));

      if (props.showEdit && state.value === 'viewing') {
        children.push(h('button', {
          type: 'button',
          'data-part': 'edit-button',
          'aria-label': 'Edit this message to create a new branch',
          tabindex: 0,
          onClick: handleEdit,
        }, 'Edit'));
      }

      if (state.value === 'editing') {
        children.push(h('div', { 'data-part': 'edit-area' }, [
          h('textarea', {
            'data-part': 'edit-textarea',
            'aria-label': 'Edit message content',
            value: editText.value,
            onInput: (e: Event) => { editText.value = (e.target as HTMLTextAreaElement).value; },
            rows: 3,
          }),
          h('button', {
            type: 'button',
            'data-part': 'save-button',
            'aria-label': 'Save edited message',
            onClick: handleSave,
          }, 'Save'),
          h('button', {
            type: 'button',
            'data-part': 'cancel-button',
            'aria-label': 'Cancel editing',
            onClick: handleCancel,
          }, 'Cancel'),
        ]));
      }

      return h('div', {
        role: 'navigation',
        'aria-label': `Branch ${props.currentIndex + 1} of ${props.totalBranches}`,
        'data-surface-widget': '',
        'data-widget-name': 'message-branch-nav',
        'data-part': 'root',
        'data-state': state.value,
        'data-compact': props.compact ? 'true' : 'false',
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default MessageBranchNav;
