// ============================================================
// FormulaEditor -- Vue 3 Component
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

export interface FormulaFunction {
  name: string;
  category: string;
  signature: string;
}

export interface FormulaSuggestion {
  id: string;
  name: string;
  category: string;
  signature: string;
  isActive?: boolean;
}

export interface FormulaEditorProps {
  /** Current formula text. */
  value?: string;
  /** Default (uncontrolled) formula. */
  defaultValue?: string;
  /** Schema definition string for property resolution. */
  schema?: string;
  /** Available functions for autocomplete. */
  functions?: FormulaFunction[];
  /** Input placeholder. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Accessible label. */
  label?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when formula changes. */
  onChange?: (value: string) => void;
  /** Callback to evaluate a formula and return result. */
  onEvaluate?: (formula: string) => string | null;
  /** Callback to validate formula and return error or null. */
  onValidate?: (formula: string) => string | null;
  /** Callback to get autocomplete suggestions. */
  onSuggest?: (query: string) => FormulaSuggestion[];
}

export const FormulaEditor = defineComponent({
  name: 'FormulaEditor',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    schema: { type: String },
    functions: { type: Array as PropType<any[]>, default: () => ([]) },
    placeholder: { type: String, default: 'Enter formula...' },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    label: { type: String, default: 'Formula' },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    onEvaluate: { type: Function as PropType<(...args: any[]) => any> },
    onValidate: { type: Function as PropType<(...args: any[]) => any> },
    onSuggest: { type: Array as PropType<any[]> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ content: props.defaultValue ? 'editing' : 'empty', interaction: 'idle', previewing: 'idle', validation: 'valid', activeIndex: 0, errorMessage: '', previewResult: '', });
    const send = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const autocompleteRef = ref<any>(null);
    const textRef = ref<any>(props.value ?? props.defaultValue);
    const handleInput = () => {
    const el = inputRef.value;
    if (!el) return;
    const text = el.textContent ?? '';
    textRef.value = text;
    props.onChange?.(text);

    if (text === '') {
      send({ type: 'CLEAR' });
    } else {
      send({ type: 'INPUT' });
    }

    // Validate
    if (props.onValidate && text) {
      const error = props.onValidate(text);
      if (error) {
        send({ type: 'SYNTAX_ERROR', message: error });
      } else {
        send({ type: 'VALIDATE' });
      }
    }

    // Check for autocomplete triggers (function names, property accessors)
    if (props.onSuggest && text) {
      const lastChar = text[text.length - 1];
      if (lastChar === '(' || lastChar === '.' || /[a-zA-Z]/.test(lastChar)) {
        const results = props.onSuggest(text);
        if (results.length > 0) {
          send({ type: 'SHOW_AC' });
        }
      }
    }
  };
    const selectSuggestion = (suggestion: FormulaSuggestion) => {
      const el = inputRef.value;
      if (!el) return;
      // Simple: append the suggestion name
      const text = textRef.value;
      // Find the last partial token and replace
      const match = text.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      let newText = text;
      if (match) {
        newText = text.slice(0, text.length - match[1].length) + suggestion.name;
      } else {
        newText = text + suggestion.name;
      }
      textRef.value = newText;
      el.textContent = newText;
      props.onChange?.(newText);
      send({ type: 'SELECT_SUGGESTION' });
      el.focus();
    };

  const handleEvaluate = () => {
    if (!props.onEvaluate) return;
    const result = props.onEvaluate(textRef.value);
    if (result !== null) {
      send({ type: 'EVALUATE', result });
    }
  };
    const el = inputRef.value;
    const text = el.textContent ?? '';
    const result = props.onEvaluate(textRef.value);

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': 'Formula editor',
        'data-part': 'root',
        'data-state': isEmpty ? 'empty' : 'filled',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-valid': !isInvalid ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'formula-editor',
      }, [
        h('div', {
          'ref': inputRef,
          'role': 'combobox',
          'aria-autocomplete': 'list',
          'aria-haspopup': 'listbox',
          'aria-expanded': isAutocompleting ? 'true' : 'false',
          'aria-controls': autocompleteId,
          'aria-activedescendant': isAutocompleting ? activeSuggestionId : undefined,
          'aria-invalid': isInvalid ? 'true' : 'false',
          'aria-describedby': isInvalid ? errorId : previewId,
          'aria-label': 'Formula input',
          'contenteditable': !props.readOnly && !props.disabled,
          'spellcheck': false,
          'data-part': 'input',
          'data-empty': isEmpty ? 'true' : 'false',
          'tabindex': props.disabled ? -1 : 0,
          'suppressContentEditableWarning': true,
          'onInput': handleInput,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
          'onPaste': () => send({ type: 'PASTE' }),
          'onKeyDown': handleKeyDown,
        }),
        h('div', {
          'ref': autocompleteRef,
          'id': autocompleteId,
          'role': 'listbox',
          'aria-label': 'Suggestions',
          'data-part': 'autocomplete',
          'data-state': isAutocompleting ? 'open' : 'closed',
          'data-visible': isAutocompleting ? 'true' : 'false',
        }, [
          ...isAutocompleting && suggestions.map((suggestion, index) => h('div', {
              'id': `formula-suggestion-${suggestion.id}`,
              'role': 'option',
              'aria-selected': index === activeIndex ? 'true' : 'false',
              'aria-props': true,
              'label': `${suggestion.name} - ${suggestion.signature}`,
              'data-part': 'suggestion',
              'data-active': index === activeIndex ? 'true' : 'false',
              'data-category': suggestion.category,
              'onClick': () => selectSuggestion(suggestion),
              'onMouseEnter': () => send({ type: 'HIGHLIGHT', index }),
            }, [
              h('span', { 'data-part': 'suggestion-name' }, [
                suggestion.name,
              ]),
              h('span', { 'data-part': 'suggestion-signature' }, [
                suggestion.signature,
              ]),
            ])),
        ]),
        h('div', {
          'role': 'tree',
          'aria-label': 'Function browser',
          'data-part': 'function-browser',
        }),
        h('div', {
          'id': previewId,
          'role': 'status',
          'aria-live': 'polite',
          'aria-label': 'Formula result',
          'data-part': 'preview',
          'data-visible': isPreviewShowing ? 'true' : 'false',
        }, [
          isPreviewShowing ? machine.value.previewResult : '',
        ]),
        h('span', {
          'id': errorId,
          'role': 'alert',
          'aria-live': 'assertive',
          'data-part': 'error',
          'data-visible': isInvalid ? 'true' : 'false',
        }, [
          isInvalid ? machine.value.errorMessage : '',
        ]),
      ]);
  },
});)

export default FormulaEditor;