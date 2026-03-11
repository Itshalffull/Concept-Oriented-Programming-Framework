// ============================================================
// CheckboxGroup -- Vue 3 Component
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

export interface CheckboxGroupProps {
  /** Currently selected values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
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
  /** Minimum selections */
  min?: number;
  /** Maximum selections */
  max?: number;
  /** Change callback */
  onChange?: (values: string[]) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const CheckboxGroup = defineComponent({
  name: 'CheckboxGroup',

  props: {
    values: { type: Array as PropType<any[]> },
    defaultValues: { type: Array as PropType<any[]>, default: () => ([]) },
    options: { type: Array as PropType<any[]>, required: true as const },
    orientation: { type: String, default: 'vertical' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    min: { type: Number },
    max: { type: Number },
    onChange: { type: Array as PropType<any[]> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const _itemState = ref<any>('unchecked');
    const dispatchItem = (action: any) => { /* state machine dispatch */ };
    const valuesInternal = ref<any>(undefined);
    const values = computed(() => props.values !== undefined ? props.values : valuesInternal.value ?? props.defaultValues);
    const setValues = (v: any) => { valuesInternal.value = v; };
    const groupName = props.name ?? uid;
    const labelId = `${uid}-label`;

    return (): VNode =>
      h('label', {
        'data-part': 'item',
        'data-state': isChecked ? 'checked' : 'unchecked',
        'data-disabled': isDisabled ? 'true' : 'false',
      }, [
        h('input', {
          'type': 'checkbox',
          'data-part': 'itemInput',
          'id': optionId,
          'name': `${groupName}[]`,
          'value': option.value,
          'checked': isChecked,
          'disabled': isDisabled,
          'role': 'checkbox',
          'aria-checked': isChecked ? 'true' : 'false',
          'aria-disabled': isDisabled ? 'true' : 'false',
          'aria-label': option.label,
          'onChange': () => handleToggle(option.value),
          'style': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
        }),
        h('span', {
          'data-part': 'itemControl',
          'data-state': isChecked ? 'checked' : 'unchecked',
          'data-disabled': isDisabled ? 'true' : 'false',
          'aria-hidden': 'true',
        }),
        h('span', { 'data-part': 'itemLabel' }, [
          option.label,
        ]),
      ]);
  },
});

export default CheckboxGroup;