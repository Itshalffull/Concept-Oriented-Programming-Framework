import { defineComponent, h, ref, watch, onMounted, computed, nextTick } from 'vue';

export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT'; value?: string }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

export const PromptInput = defineComponent({
  name: 'PromptInput',
  props: {
    value: { type: String, required: true },
    placeholder: { type: String, default: 'Type a message...' },
    maxLength: { type: Number, default: undefined },
    showModelSelector: { type: Boolean, default: true },
    showAttach: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['submit', 'update:value', 'change', 'attach'],
  setup(props, { emit, slots }) {
    const state = ref<PromptInputState>(props.value ? 'composing' : 'empty');
    const textareaRef = ref<HTMLTextAreaElement | null>(null);

    function send(event: PromptInputEvent) {
      state.value = promptInputReducer(state.value, event);
    }

    function resizeTextarea() {
      const ta = textareaRef.value;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }

    watch(() => props.value, () => { nextTick(resizeTextarea); });

    onMounted(() => {
      resizeTextarea();
      textareaRef.value?.focus();
    });

    function handleInput(e: Event) {
      const val = (e.target as HTMLTextAreaElement).value;
      emit('update:value', val);
      emit('change', val);
      if (val.length === 0) send({ type: 'CLEAR' });
      else send({ type: 'INPUT', value: val });
    }

    async function handleSubmit() {
      if (!props.value.trim() || props.disabled || state.value === 'submitting') return;
      send({ type: 'SUBMIT' });
      try {
        emit('submit', props.value);
        send({ type: 'SUBMIT_COMPLETE' });
      } catch {
        send({ type: 'SUBMIT_ERROR' });
      }
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        emit('update:value', '');
        emit('change', '');
        send({ type: 'CLEAR' });
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        send({ type: 'ATTACH' });
        emit('attach');
      }
    }

    const isSubmitDisabled = computed(() => state.value === 'empty' || state.value === 'submitting' || props.disabled);
    const isInputDisabled = computed(() => state.value === 'submitting' || props.disabled);

    return () => {
      const children: any[] = [];

      children.push(h('textarea', {
        ref: (el: any) => { textareaRef.value = el; },
        'data-part': 'textarea',
        'data-state': state.value,
        'data-empty': state.value === 'empty' ? 'true' : 'false',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Type your message',
        placeholder: props.placeholder,
        value: props.value,
        maxlength: props.maxLength,
        disabled: isInputDisabled.value,
        rows: 1,
        onInput: handleInput,
        onKeydown: handleKeydown,
        onPaste: () => { if (state.value === 'empty') send({ type: 'PASTE' }); },
        style: { resize: 'none', overflow: 'auto' },
      }));

      if (props.showAttach) {
        children.push(h('button', {
          type: 'button',
          'data-part': 'attach-button',
          'data-state': state.value,
          'data-visible': 'true',
          'aria-label': 'Attach file',
          tabindex: 0,
          disabled: isInputDisabled.value,
          onClick: () => { send({ type: 'ATTACH' }); emit('attach'); },
        }, 'Attach'));
      }

      if (props.showModelSelector) {
        children.push(h('div', {
          'data-part': 'model-selector',
          'data-state': state.value,
          'data-visible': 'true',
        }, slots.default?.()));
      }

      children.push(h('span', {
        'data-part': 'counter',
        'data-state': state.value,
        role: 'status',
        'aria-live': 'polite',
      }, props.value.length + (props.maxLength != null ? ` / ${props.maxLength}` : '')));

      children.push(h('button', {
        type: 'button',
        'data-part': 'submit-button',
        'data-state': state.value,
        'aria-label': 'Send message',
        'aria-disabled': isSubmitDisabled.value ? 'true' : 'false',
        tabindex: 0,
        disabled: isSubmitDisabled.value,
        onClick: handleSubmit,
      }, state.value === 'submitting'
        ? h('span', { 'data-part': 'spinner', 'aria-hidden': 'true' })
        : 'Send'));

      children.push(h('div', { 'data-part': 'toolbar', 'data-state': state.value, role: 'toolbar' }));

      return h('div', {
        role: 'group',
        'aria-label': 'Message input',
        'data-surface-widget': '',
        'data-widget-name': 'prompt-input',
        'data-part': 'root',
        'data-state': state.value,
        'data-disabled': props.disabled ? 'true' : 'false',
      }, children);
    };
  },
});

export default PromptInput;
