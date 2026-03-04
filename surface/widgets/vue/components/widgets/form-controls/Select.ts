// ============================================================
// Select -- Vue 3 Component
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

export interface SelectProps {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
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
  /** Change callback */
  onChange?: (value: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const Select = defineComponent({
  name: 'Select',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    options: { type: Array as PropType<any[]>, required: true as const },
    placeholder: { type: String, default: 'Select...' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const openState = ref<any>('closed');
    const dispatchOpen = (action: any) => { /* state machine dispatch */ };
    const _focusState = ref<any>('idle');
    const dispatchFocus = (action: any) => { /* state machine dispatch */ };
    const highlightedIndex = ref<any>(-1);
    const setHighlightedIndex = (v: any) => { highlightedIndex.value = typeof v === 'function' ? v(highlightedIndex.value) : v; };
    const triggerRef = ref<any>(null);
    const contentRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };

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
        'onClick': () => !option.disabled && handleSelect(option.value),
        'onPointerEnter': () => setHighlightedIndex(index),
      }, [
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
        isSelected ? h('span', { 'data-part': 'itemIndicator', 'aria-hidden': 'true' }) : null,
      ]);
  },
});

export default Select;