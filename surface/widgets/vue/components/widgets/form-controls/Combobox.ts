// ============================================================
// Combobox -- Vue 3 Component
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
  disabled?: boolean;
}

export interface ComboboxProps {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Current input value */
  inputValue?: string;
  /** Available options */
  options: OptionItem[];
  /** Placeholder text */
  placeholder?: string;
  /** Allow creating custom values */
  allowCustom?: boolean;
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: string) => void;
  /** Input change callback */
  onInputChange?: (inputValue: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const Combobox = defineComponent({
  name: 'Combobox',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    inputValue: { type: String },
    options: { type: Array as PropType<any[]>, required: true as const },
    placeholder: { type: String, default: 'Search...' },
    allowCustom: { type: Boolean, default: false },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
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
    const highlightedIndex = ref<any>(-1);
    const setHighlightedIndex = (v: any) => { highlightedIndex.value = typeof v === 'function' ? v(highlightedIndex.value) : v; };
    const inputRef = ref<any>(null);
    const contentRef = ref<any>(null);
    const rootRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };
    const handleInputChange = (e: any) => {
      const next = e.target.value;
      setLocalInputValue(next);
      props.onInputChange?.(next);
      dispatchOpen({ type: 'INPUT' });
      dispatchFilter({ type: 'BEGIN_FILTER' });
      setHighlightedIndex(0);
    };

  const handleSelect = (optionValue: string) => {
      const opt = props.options.find((o) => o.value === optionValue);
      setValue(optionValue);
      setLocalInputValue(opt?.label ?? optionValue);
      props.onInputChange?.(opt?.label ?? optionValue);
      dispatchOpen({ type: 'SELECT' });
      dispatchFilter({ type: 'END_FILTER' });
      inputRef.value?.focus();
    };

  const handleClear = () => {
    setValue('');
    setLocalInputValue('');
    props.onInputChange?.('');
    inputRef.value?.focus();
  };
    const filteredOptions = computed(() => props.options.filter((o) =>
        o.label.toLowerCase().includes(props.inputValue.toLowerCase()),
      );

  // Close on outside click
  (() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
        dispatchOpen({ type: 'BLUR' });
        dispatchFilter({ type: 'END_FILTER' });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

    return (): VNode =>
      h('div', {
        'id': `${uid}-opt-${option.value}`,
        'data-part': 'item',
        'data-state': isSelected ? 'selected' : 'unselected',
        'data-highlighted': isHighlighted ? 'true' : 'false',
        'role': 'option',
        'aria-selected': isSelected ? 'true' : 'false',
        'aria-disabled': option.disabled ? 'true' : 'false',
        'aria-label': option.label,
        'onClick': () => !option.disabled && handleSelect(option.value),
        'onPointerEnter': () => setHighlightedIndex(index),
      }, [
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
      ]);
  },
});)

export default Combobox;