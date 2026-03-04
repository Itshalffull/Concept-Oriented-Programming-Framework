// ============================================================
// ChipInput -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface ChipInputProps {
  /** Current chip values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
  /** Allow creating custom values */
  allowCreate?: boolean;
  /** Maximum number of chips */
  maxItems?: number;
  /** Separator character (default comma) */
  separator?: string;
  /** Visible label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Autocomplete suggestions */
  suggestions?: string[];
  /** Value validator (regex pattern) */
  validateValue?: string;
  /** Change callback */
  onChange?: (values: string[]) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const ChipInput = defineComponent({
  name: 'ChipInput',

  props: {
    values: { type: Array as PropType<any[]> },
    defaultValues: { type: Array as PropType<any[]>, default: () => ([]) },
    allowCreate: { type: Boolean, default: true },
    maxItems: { type: Number },
    separator: { type: String, default: ',' },
    label: { type: String, required: true as const },
    placeholder: { type: String, default: 'Type and press Enter...' },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    suggestions: { type: Array as PropType<any[]>, default: () => ([]) },
    validateValue: { type: String },
    onChange: { type: Array as PropType<any[]> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const interactionState = ref<any>('idle');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const inputText = ref<any>('');
    const setInputText = (v: any) => { inputText.value = typeof v === 'function' ? v(inputText.value) : v; };
    const highlightedSuggestion = ref<any>(-1);
    const setHighlightedSuggestion = (v: any) => { highlightedSuggestion.value = typeof v === 'function' ? v(highlightedSuggestion.value) : v; };
    const inputRef = ref<any>(null);
    const rootRef = ref<any>(null);
    const valuesInternal = ref<any>(undefined);
    const values = computed(() => props.values !== undefined ? props.values : valuesInternal.value ?? props.defaultValues);
    const setValues = (v: any) => { valuesInternal.value = v; };
    const isValid = (val: string): boolean => {
      if (!val.trim()) return false;
      if (values.includes(val.trim())) return false;
      if (props.validateValue) {
        try {
          return new RegExp(props.validateValue).test(val.trim());
        } catch {
          return true;
        }
      }
      return true;
    };

  const addChip = (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      if (props.maxItems !== undefined && values.length >= props.maxItems) return;
      if (values.includes(trimmed)) return;
      if (!isValid(trimmed)) return;
      setValues([...values, trimmed]);
      setInputText('');
    };

  const removeChip = (index: number) => {
      setValues(values.filter((_, i) => i !== index));
    };

  const removeLast = () => {
    if (values.length > 0) {
      setValues(values.slice(0, -1));
    }
  };
    const filteredSuggestions = computed(() => props.suggestions.filter(
        (s) =>
          s.toLowerCase().includes(inputText.toLowerCase()) &&
          !values.includes(s),
      );

  // Show/hide props.suggestions based on input text
  (() => {
    if (interactionState.value === 'typing' && inputText && filteredSuggestions.length > 0) {
      dispatch({ type: 'SUGGEST' });
      setHighlightedSuggestion(0);
    } else if (interactionState.value === 'suggesting' && filteredSuggestions.length === 0 && !inputText) {
      dispatch({ type: 'CLOSE' });
    }
  }, [inputText, filteredSuggestions.length, interactionState.value]);

  // Close on outside click
  (() => {
    if (!isSuggesting) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
        dispatch({ type: 'BLUR' });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

    return (): VNode =>
      h('div', {
        'ref': setRefCallback,
        'data-surface-widget': '',
        'data-widget-name': 'chip-input',
        'data-part': 'root',
        'data-state': interactionState.value,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
      }, [
        h('label', {
          'data-part': 'label',
          'id': labelId,
          'for': uid,
        }, [
          props.label,
        ]),
        h('div', {
          'data-part': 'inputWrapper',
          'data-state': interactionState.value,
          'data-focus': interactionState.value !== 'idle' ? 'true' : 'false',
          'onClick': () => {
          if (!props.disabled) inputRef.value?.focus();
        },
        }, [
          values.length > 0 ? h('div', {
              'data-part': 'chipList',
              'role': 'list',
              'aria-label': 'Entered values',
              'aria-live': 'polite',
            }, [
              ...values.map((val, index) => h('span', {
                  'data-part': 'chip',
                  'data-value': val,
                  'role': 'listitem',
                  'aria-props': true,
                  'label': `Remove ${val}`,
                }, [
                  val,
                  h('button', {
                    'type': 'button',
                    'aria-props': true,
                    'label': `Remove ${val}`,
                    'tabindex': -1,
                    'onClick': (e) => {
                    e.stopPropagation();
                    removeChip(index);
                  },
                  }, '×'),
                ])),
            ]) : null,
          h('input', {
            'ref': inputRef,
            'id': uid,
            'data-part': 'input',
            'type': 'text',
            'role': 'combobox',
            'value': inputText,
            'placeholder': values.length === 0 ? placeholder : '',
            'disabled': props.disabled || isAtMax,
            'name': props.name,
            'aria-label': props.label,
            'aria-expanded': isSuggesting ? 'true' : 'false',
            'aria-haspopup': 'listbox',
            'aria-controls': suggestionsId,
            'aria-activedescendant': isSuggesting && highlightedSuggestion >= 0 && filteredSuggestions[highlightedSuggestion]
              ? `${uid}-sug-${highlightedSuggestion}`
              : undefined,
            'aria-autocomplete': 'list',
            'aria-disabled': props.disabled ? 'true' : 'false',
            'aria-labelledby': labelId,
            'autocomplete': 'off',
            'onChange': handleInputChange,
            'onFocus': () => dispatch({ type: 'FOCUS' }),
            'onBlur': () => {
            // Small delay to allow click on props.suggestions
            setTimeout(() => dispatch({ type: 'BLUR' }), 150);
          },
            'onKeyDown': handleKeyDown,
          }),
        ]),
        isSuggesting && filteredSuggestions.length > 0 ? h('div', { 'data-part': 'positioner' }, [
            h('div', {
              'id': suggestionsId,
              'data-part': 'suggestions',
              'role': 'listbox',
              'aria-labelledby': labelId,
            }, [
              ...filteredSuggestions.map((suggestion, index) => h('div', {
                  'id': `${uid}-sug-${index}`,
                  'data-part': 'suggestion',
                  'data-highlighted': index === highlightedSuggestion ? 'true' : 'false',
                  'role': 'option',
                  'aria-props': true,
                  'label': suggestion,
                  'onClick': () => {
                  addChip(suggestion);
                  dispatch({ type: 'SELECT_SUGGESTION' });
                  inputRef.value?.focus();
                },
                  'onPointerEnter': () => setHighlightedSuggestion(index),
                }, [
                  suggestion,
                ])),
              props.allowCreate &&
              inputText.trim() &&
              !filteredSuggestions.includes(inputText.trim()) ? h('div', {
                  'data-part': 'createOption',
                  'role': 'option',
                  'aria-label': `Create "${inputText}"`,
                  'onClick': () => {
                    addChip(inputText.trim());
                    dispatch({ type: 'CREATE' });
                    inputRef.value?.focus();
                  },
                }, [
                  'Create &quot;',
                  inputText,
                  '&quot;',
                ]) : null,
            ]),
          ]) : null,
        ...props.name &&
        values.map((val, i) => h('input', {
            'type': 'hidden',
            'props': true,
            'name': `${name}[]`,
            'value': val,
          })),
      ]);
  },
});)

export default ChipInput;