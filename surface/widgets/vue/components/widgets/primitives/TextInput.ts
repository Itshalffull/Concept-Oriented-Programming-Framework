// ============================================================
// TextInput -- Vue 3 Component
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

export interface TextInputProps {
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  pattern?: string;
  name?: string;
  autocomplete?: string;
  label?: string;
  description?: string;
  error?: string;
  prefix?: VNode | string;
  suffix?: VNode | string;
  onChange?: (value: string) => void;
  onClear?: () => void;
}

export const TextInput = defineComponent({
  name: 'TextInput',

  props: {
    value: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    maxLength: { type: Number },
    pattern: { type: String },
    name: { type: String },
    autocomplete: { type: String },
    label: { type: String },
    description: { type: String },
    error: { type: String },
    prefix: { type: null as unknown as PropType<any> },
    suffix: { type: null as unknown as PropType<any> },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    onClear: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change', 'clear'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ fill: props.value.length > 0 ? 'filled' : 'empty', focus: 'idle', validity: props.error ? 'invalid' : 'valid', });
    const send = (action: any) => { /* state machine dispatch */ };
    const handleInput = (e: any) => {
        const val = e.target.value;
        send({ type: 'INPUT', value: val });
        props.onChange?.(val);
      };
    const handleClear = () => {
      send({ type: 'CLEAR' });
      props.onChange?.('');
      props.onClear?.();
    };
    const handleKeyDown = (e: any) => {
        if (e.key === 'Escape') {
          handleClear();
        }
      };
    const inputId = props.name || generatedId;
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;
    const labelId = `${inputId}-label`;
    const isInvalid = state.value.validity === 'invalid' || !!props.error;
    const isFocused = state.value.focus === 'focused';
    const isFilled = state.value.fill === 'filled' || props.value.length > 0;
    const rootDataState = props.disabled ? 'disabled' : props.readOnly ? 'readonly' : 'default';

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'text-input',
        'data-part': 'root',
        'data-state': rootDataState,
        'data-focus': isFocused ? 'true' : 'false',
        'data-invalid': isInvalid ? 'true' : 'false',
      }, [
        props.label ? h('label', {
            'id': labelId,
            'for': inputId,
            'data-part': 'label',
            'data-required': props.required ? 'true' : 'false',
          }, [
            props.label,
          ]) : null,
        props.prefix ? h('span', { 'data-part': 'prefix', 'aria-hidden': 'true' }, [
            props.prefix,
          ]) : null,
        h('input', {
          'id': inputId,
          'type': 'text',
          'role': 'textbox',
          'value': props.value,
          'placeholder': props.placeholder,
          'disabled': props.disabled,
          'readonly': props.readOnly,
          'required': props.required,
          'maxlength': props.maxLength,
          'pattern': props.pattern,
          'name': props.name,
          'autocomplete': props.autocomplete,
          'aria-invalid': isInvalid ? 'true' : 'false',
          'aria-required': props.required ? 'true' : 'false',
          'aria-disabled': props.disabled ? 'true' : 'false',
          'aria-readonly': props.readOnly ? 'true' : 'false',
          'aria-labelledby': props.label ? labelId : undefined,
          'aria-describedby': isInvalid ? errorId : props.description ? descriptionId : undefined,
          'onChange': handleInput,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
          'onKeyDown': handleKeyDown,
          'data-part': 'input',
        }),
        props.suffix ? h('span', { 'data-part': 'suffix', 'aria-hidden': 'true' }, [
            props.suffix,
          ]) : null,
        isFilled && !props.disabled && !props.readOnly ? h('button', {
            'type': 'button',
            'data-part': 'clear-button',
            'role': 'button',
            'aria-label': 'Clear input',
            'tabindex': -1,
            'data-visible': isFilled ? 'true' : 'false',
            'onClick': handleClear,
          }) : null,
        props.description ? h('span', { 'id': descriptionId, 'data-part': 'description' }, [
            props.description,
          ]) : null,
        props.error ? h('span', {
            'id': errorId,
            'data-part': 'error',
            'role': 'alert',
            'aria-live': 'polite',
            'data-visible': isInvalid ? 'true' : 'false',
          }, [
            props.error,
          ]) : null,
      ]);
  },
});

export default TextInput;