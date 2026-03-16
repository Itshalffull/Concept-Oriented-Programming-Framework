// ============================================================
// MentionInput -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface MentionTrigger {
  char: string;
  dataSource: string;
}

export interface MentionSuggestion {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

export interface MentionChip {
  label: string;
  value: string;
  triggerChar: string;
}

export interface MentionInputProps {
  /** Trigger character configurations. */
  triggers: MentionTrigger[];
  /** Current text value. */
  value?: string;
  /** Default (uncontrolled) text value. */
  defaultValue?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Maximum number of suggestions shown. */
  maxSuggestions?: number;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when text changes. */
  onChange?: (value: string) => void;
  /** Callback to fetch suggestions for a trigger and query. */
  onQuerySuggestions?: (trigger: string, query: string) => MentionSuggestion[];
  /** Callback when a mention is selected. */
  onMentionSelect?: (mention: MentionChip) => void;
}

export const MentionInput = defineComponent({
  name: 'MentionInput',

  props: {
    triggers: { type: Array as PropType<any[]>, required: true as const },
    value: { type: String },
    defaultValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    maxSuggestions: { type: Number, default: 10 },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    onQuerySuggestions: { type: Array as PropType<any[]> },
    onMentionSelect: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change', 'mention-select'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ trigger: 'idle', focus: 'unfocused', navigation: 'none', activeTriggerChar: '', query: '', activeIndex: 0, });
    const send = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const suggestionsRef = ref<any>(null);
    const textRef = ref<any>(props.value ?? props.defaultValue);

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': 'Mention input',
        'data-part': 'root',
        'data-state': isSuggesting ? 'suggesting' : machine.value.trigger === 'triggered' ? 'triggered' : 'idle',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'mention-input',
      }, [
        h('textarea', {
          'ref': inputRef,
          'role': 'combobox',
          'aria-autocomplete': 'list',
          'aria-haspopup': 'listbox',
          'aria-expanded': isSuggesting ? 'true' : 'false',
          'aria-controls': suggestionsListId,
          'aria-activedescendant': isSuggesting ? activeSuggestionId : undefined,
          'value': props.value ?? textRef.value,
          'placeholder': props.placeholder,
          'disabled': props.disabled,
          'readonly': props.readOnly,
          'data-part': 'input',
          'tabindex': props.disabled ? -1 : 0,
          'onInput': handleInput,
          'onChange': handleInput,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => {
          // Delay blur to allow click on suggestion
          setTimeout(() => send({ type: 'BLUR' }), 200);
        },
          'onKeyDown': handleKeyDown,
        }),
        h('div', {
          'ref': suggestionsRef,
          'id': suggestionsListId,
          'role': 'listbox',
          'aria-label': 'Suggestions',
          'data-part': 'suggestions',
          'data-state': isSuggesting ? 'open' : 'closed',
          'data-visible': isSuggesting ? 'true' : 'false',
          'data-trigger': machine.value.activeTriggerChar,
        }, [
          ...isSuggesting ? suggestions.map((suggestion: any, index: number) => h('div', {
              'id': `mention-suggestion-${suggestion.id}`,
              'role': 'option',
              'aria-selected': index === activeIndex ? 'true' : 'false',
              'aria-label': suggestion.label,
              'data-part': 'suggestion',
              'data-active': index === activeIndex ? 'true' : 'false',
              'data-index': index,
              'onClick': () => selectSuggestion(suggestion),
              'onMouseEnter': () => send({ type: 'HIGHLIGHT', index }),
            }, [
              suggestion.icon ? h('span', { 'data-part': 'suggestion-icon', 'aria-hidden': 'true' }) : null,
            ])) : [],
        ]),
      ]);
  },
});

export default MentionInput;