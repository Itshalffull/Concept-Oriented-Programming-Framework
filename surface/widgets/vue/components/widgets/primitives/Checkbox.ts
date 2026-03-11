// ============================================================
// Checkbox -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
  label?: VNode | string;
  onChange?: (checked: boolean) => void;
}

export const Checkbox = defineComponent({
  name: 'Checkbox',

  props: {
    checked: { type: Boolean, default: false },
    indeterminate: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    value: { type: String, default: '' },
    name: { type: String },
    label: { type: null as unknown as PropType<any> },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ checked: props.checked, focused: false, });
    const send = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const handleToggle = () => {
      if (props.disabled) return;
      send({ type: 'TOGGLE' });
      props.onChange?.(!isChecked);
    };
    const inputId = props.name || generatedId;
    const labelId = `${inputId}-label`;
    const isChecked = props.checked !== undefined ? checked : state.checked;
    onMounted(() => {
      if (inputRef.value) {
      inputRef.value.indeterminate = props.indeterminate;
      }
    });

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'checkbox',
        'data-part': 'root',
        'data-state': dataState,
        'data-disabled': props.disabled ? 'true' : 'false',
        'onClick': handleToggle,
      }, [
        h('input', {
          'ref': inputRef,
          'id': inputId,
          'type': 'checkbox',
          'role': 'checkbox',
          'checked': isChecked,
          'disabled': props.disabled,
          'required': props.required,
          'value': props.value,
          'name': props.name,
          'aria-checked': ariaChecked,
          'aria-required': props.required ? 'true' : 'false',
          'aria-disabled': props.disabled ? 'true' : 'false',
          'aria-labelledby': props.label ? labelId : undefined,
          'onChange': handleToggle,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
          'tabindex': props.disabled ? -1 : 0,
          'data-part': 'input',
          'style': { position: 'absolute', opacity: 0, width: 0, height: 0, margin: 0 },
        }),
        h('span', {
          'data-part': 'control',
          'data-state': dataState,
          'data-disabled': props.disabled ? 'true' : 'false',
          'data-focused': state.value.focused ? 'true' : 'false',
          'aria-hidden': 'true',
        }, [
          h('span', {
            'data-part': 'indicator',
            'data-state': dataState,
            'data-visible': isChecked || props.indeterminate ? 'true' : 'false',
            'aria-hidden': 'true',
          }),
        ]),
        props.label ? h('label', {
            'id': labelId,
            'for': inputId,
            'data-part': 'label',
            'data-disabled': props.disabled ? 'true' : 'false',
          }, [
            props.label,
          ]) : null,
      ]);
  },
});

export default Checkbox;