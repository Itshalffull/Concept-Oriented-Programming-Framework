// ============================================================
// SegmentedControl -- Vue 3 Component
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
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface SegmentOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Available segment options (minimum 2) */
  options: SegmentOption[];
  /** Size variant */
  size?: 'sm' | 'md';
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: string) => void;
}

export const SegmentedControl = defineComponent({
  name: 'SegmentedControl',

  props: {
    value: { type: String },
    defaultValue: { type: String },
    options: { type: Array as PropType<any[]>, required: true as const },
    size: { type: String, default: 'md' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const _itemState = ref<any>('unselected');
    const dispatchItem = (action: any) => { /* state machine dispatch */ };
    const indicatorState = ref<any>('idle');
    const dispatchIndicator = (action: any) => { /* state machine dispatch */ };
    const itemsRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.defaultValue);
    const setValue = (v: any) => { valueInternal.value = v; };

    return (): VNode =>
      h('button', {
        'type': 'button',
        'data-part': 'item',
        'data-value': option.value,
        'data-state': isSelected ? 'selected' : 'unselected',
        'data-disabled': props.disabled ? 'true' : 'false',
        'role': 'radio',
        'aria-checked': isSelected ? 'true' : 'false',
        'aria-label': option.label,
        'aria-disabled': props.disabled ? 'true' : 'false',
        'tabindex': isSelected ? 0 : -1,
        'disabled': props.disabled,
        'onClick': () => handleSelect(option.value),
        'onKeyDown': (e) => handleKeyDown(e, option.value),
      }, [
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
      ]);
  },
});

export default SegmentedControl;