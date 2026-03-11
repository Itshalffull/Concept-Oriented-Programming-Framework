// ============================================================
// RadioGroup -- Vue 3 Component
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

export interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Available options */
  options: OptionItem[];
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
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

export const RadioGroup = defineComponent({
  name: 'RadioGroup',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    options: { type: Array as PropType<any[]>, required: true as const },
    orientation: { type: String, default: 'vertical' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const _itemState = ref<any>('unselected');
    const dispatchItem = (action: any) => { /* state machine dispatch */ };
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };

    return (): VNode =>
      h('label', {
        'data-part': 'item',
        'data-state': isSelected ? 'selected' : 'unselected',
        'data-disabled': isDisabled ? 'true' : 'false',
      }, [
        h('input', {
          'type': 'radio',
          'data-part': 'itemInput',
          'id': optionId,
          'name': groupName,
          'value': option.value,
          'checked': isSelected,
          'disabled': isDisabled,
          'role': 'radio',
          'aria-checked': isSelected ? 'true' : 'false',
          'aria-disabled': isDisabled ? 'true' : 'false',
          'aria-label': option.label,
          'tabindex': isSelected ? 0 : -1,
          'onChange': () => handleChange(option.value),
          'style': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
        }),
        h('span', {
          'data-part': 'itemControl',
          'data-state': isSelected ? 'selected' : 'unselected',
          'data-disabled': isDisabled ? 'true' : 'false',
          'aria-hidden': 'true',
        }),
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
      ]);
  },
});

export default RadioGroup;