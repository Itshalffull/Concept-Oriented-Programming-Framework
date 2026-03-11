// ============================================================
// ComboboxMulti -- Vue 3 Component
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

export interface OptionItem {
  value: string;
  label: string;
}

export interface ComboboxMultiProps {
  /** Currently selected values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
  /** Current input/filter value */
  inputValue?: string;
  /** Available options */
  options: OptionItem[];
  /** Placeholder text */
  placeholder?: string;
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Maximum number of selections */
  maxSelections?: number;
  /** Change callback */
  onChange?: (values: string[]) => void;
  /** Input change callback */
  onInputChange?: (inputValue: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const ComboboxMulti = defineComponent({
  name: 'ComboboxMulti',

  props: {
    values: { type: Array as PropType<any[]> },
    defaultValues: { type: Array as PropType<any[]>, default: () => ([]) },
    inputValue: { type: String },
    options: { type: Array as PropType<any[]>, required: true as const },
    placeholder: { type: String, default: 'Search...' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    maxSelections: { type: Number },
    onChange: { type: Array as PropType<any[]> },
    onInputChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  emits: ['input-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const openState = ref<any>('closed');
    const dispatchOpen = (action: any) => { /* state machine dispatch */ };
    const _filterState = ref<any>('idle');
    const dispatchFilter = (action: any) => { /* state machine dispatch */ };
    const localInputValue = ref<any>(props.inputValue ?? '');
    const setLocalInputValue = (v: any) => { localInputValue.value = typeof v === 'function' ? v(localInputValue.value) : v; };
    const highlightedIndex = ref<any>(-1);
    const setHighlightedIndex = (v: any) => { highlightedIndex.value = typeof v === 'function' ? v(highlightedIndex.value) : v; };
    const inputRef = ref<any>(null);
    const rootRef = ref<any>(null);
    const valuesInternal = ref<any>(undefined);
    const values = computed(() => props.values !== undefined ? props.values : valuesInternal.value ?? props.defaultValues);
    const setValues = (v: any) => { valuesInternal.value = v; };
    const toggleValue = (optionValue: string) => {
        const isSelected = values.includes(optionValue);
        if (isSelected) {
          setValues(values.filter((v) => v !== optionValue));
        } else {
          if (props.maxSelections !== undefined && values.length >= props.maxSelections) return;
          setValues([...values, optionValue]);
        }
        setLocalInputValue('');
        props.onInputChange?.('');
        inputRef.value?.focus();
      };

    const removeValue = (optionValue: string) => {
        setValues(values.filter((v) => v !== optionValue));
      };

    const removeLast = () => {
      if (values.length > 0) {
        setValues(values.slice(0, -1));
      }
    };
    const filteredOptions = computed(() => props.options.filter((o) =>
          o.label.toLowerCase().includes(inputValue.toLowerCase()),
        );

    // Close on outside click
    (() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
          dispatchOpen({ type: 'BLUR' });
          dispatchFilter({ type: 'END_FILTER' });
          setLocalInputValue('');
          props.onInputChange?.('');
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    });
    const labelId = `${uid}-label`;
    const contentId = `${uid}-content`;
    const inputValue = props.inputValue ?? localInputValue;
    const isOpen = openState.value === 'open';
    onMounted(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
      if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
      dispatchOpen({ type: 'BLUR' });
      dispatchFilter({ type: 'END_FILTER' });
      setLocalInputValue('');
      props.onInputChange?.('');
      }
      };
      document.addEventListener('mousedown', handler);
    });
    onUnmounted(() => {
      document.removeEventListener('mousedown', handler)
    });

    return (): VNode =>
      h('div', {
        'id': `${uid}-opt-${option.value}`,
        'data-part': 'item',
        'data-state': isSelected ? 'selected' : 'unselected',
        'data-highlighted': isHighlighted ? 'true' : 'false',
        'role': 'option',
        'aria-selected': isSelected ? 'true' : 'false',
        'aria-label': option.label,
        'onClick': () => toggleValue(option.value),
        'onPointerEnter': () => setHighlightedIndex(index),
      }, [
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
      ]);
  },
});)

export default ComboboxMulti;