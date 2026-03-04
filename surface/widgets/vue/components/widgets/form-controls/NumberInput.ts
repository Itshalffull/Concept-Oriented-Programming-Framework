// ============================================================
// NumberInput -- Vue 3 Component
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

export interface NumberInputProps {
  /** Current value */
  value?: number;
  /** Default value when uncontrolled */
  defaultValue?: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment (default 1) */
  step?: number;
  /** Decimal precision */
  precision?: number;
  /** Visible label */
  label: string;
  /** Helper text */
  description?: string;
  /** Error message */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: number | undefined) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const NumberInput = defineComponent({
  name: 'NumberInput',

  props: {
    value: { type: Number },
    defaultValue: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number, default: 1 },
    precision: { type: Number },
    label: { type: String, required: true as const },
    description: { type: String },
    error: { type: String },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const focusState = ref<any>('idle');
    const dispatchFocus = (action: any) => { /* state machine dispatch */ };
    const validationState = ref<any>(props.error ? 'invalid' : 'valid',);
    const dispatchValidation = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.defaultValue);
    const setValue = (v: any) => { valueInternal.value = v; };
    const clamp = (v: number): number => {
      let clamped = v;
      if (props.min !== undefined) clamped = Math.max(props.min, clamped);
      if (props.max !== undefined) clamped = Math.min(props.max, clamped);
      return clamped;
    };

  const formatValue = (
(v: number | undefined): string => {
      if (v === undefined) return '';
      if (props.precision !== undefined) return v.toFixed(props.precision);
      return String(v);
    };

  const applyDelta = (delta: number) => {
      if (props.disabled || props.readOnly) return;
      const current = value ?? props.min ?? 0;
      const next = clamp(current + delta);
      setValue(next);
    };

  const increment = () => applyDelta(props.step);
    const decrement = () => applyDelta(-props.step);

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'number-input',
        'data-part': 'root',
        'data-state': focusState.value === 'focused' ? 'focused' : 'idle',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-invalid': isInvalid ? 'true' : 'false',
        'data-size': props.size,
      }, [
        h('label', { 'data-part': 'label', 'for': uid }, [
          props.label,
        ]),
        h('input', {
          'ref': inputRef,
          'id': uid,
          'data-part': 'input',
          'type': 'text',
          'inputmode': 'decimal',
          'role': 'spinbutton',
          'value': formatValue(value),
          'placeholder': props.placeholder,
          'disabled': props.disabled,
          'readonly': props.readOnly,
          'required': props.required,
          'name': props.name,
          'aria-label': props.label,
          'aria-valuenow': value,
          'aria-valuemin': props.min,
          'aria-valuemax': props.max,
          'aria-invalid': isInvalid ? 'true' : 'false',
          'aria-errormessage': isInvalid ? errorId : undefined,
          'aria-describedby': props.description ? descriptionId : undefined,
          'autocomplete': 'off',
          'onChange': handleInputChange,
          'onFocus': () => {
          dispatchFocus({ type: 'FOCUS' });
          inputRef.value?.select();
        },
          'onBlur': () => dispatchFocus({ type: 'BLUR' }),
          'onKeyDown': handleKeyDown,
        }),
        h('button', {
          'type': 'button',
          'data-part': 'decrementButton',
          'aria-label': 'Decrease value',
          'aria-disabled': atMin || props.disabled ? 'true' : 'false',
          'aria-hidden': 'true',
          'disabled': props.disabled || atMin,
          'onClick': decrement,
          'tabindex': -1,
        }, '&minus;'),
        h('button', {
          'type': 'button',
          'data-part': 'incrementButton',
          'aria-label': 'Increase value',
          'aria-disabled': atMax || props.disabled ? 'true' : 'false',
          'aria-hidden': 'true',
          'disabled': props.disabled || atMax,
          'onClick': increment,
          'tabindex': -1,
        }, '+'),
        props.description ? h('span', { 'data-part': 'description', 'id': descriptionId }, [
            props.description,
          ]) : null,
        isInvalid && props.error ? h('span', {
            'data-part': 'error',
            'id': errorId,
            'role': 'alert',
            'aria-live': 'assertive',
          }, [
            props.error,
          ]) : null,
      ]);
  },
});)

export default NumberInput;