// ============================================================
// MultiSelect -- Vue 3 Component
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

export interface MultiSelectProps {
  /** Currently selected values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
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
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const MultiSelect = defineComponent({
  name: 'MultiSelect',

  props: {
    values: { type: Array as PropType<any[]> },
    defaultValues: { type: Array as PropType<any[]>, default: () => ([]) },
    options: { type: Array as PropType<any[]>, required: true as const },
    placeholder: { type: String, default: 'Select...' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    maxSelections: { type: Number },
    onChange: { type: Array as PropType<any[]> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const openState = ref<any>('closed');
    const dispatchOpen = (action: any) => { /* state machine dispatch */ };
    const highlightedIndex = ref<any>(-1);
    const setHighlightedIndex = (v: any) => { highlightedIndex.value = typeof v === 'function' ? v(highlightedIndex.value) : v; };
    const triggerRef = ref<any>(null);
    const contentRef = ref<any>(null);
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
    };

  const removeValue = (optionValue: string) => {
      setValues(values.filter((v) => v !== optionValue));
    };

  const removeLast = () => {
    if (values.length > 0) {
      setValues(values.slice(0, -1));
    }
  };

    return (): VNode =>
      h('div', {
        'data-part': 'item',
        'data-state': isSelected ? 'selected' : 'unselected',
        'data-highlighted': isHighlighted ? 'true' : 'false',
        'data-disabled': option.disabled ? 'true' : 'false',
        'role': 'option',
        'aria-selected': isSelected ? 'true' : 'false',
        'aria-disabled': option.disabled ? 'true' : 'false',
        'aria-label': option.label,
        'onClick': () => !option.disabled && toggleValue(option.value),
        'onPointerEnter': () => setHighlightedIndex(index),
      }, [
        h('span', {
          'data-part': 'itemIndicator',
          'data-state': isSelected ? 'selected' : 'unselected',
          'aria-hidden': 'true',
        }),
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
      ]);
  },
});

export default MultiSelect;