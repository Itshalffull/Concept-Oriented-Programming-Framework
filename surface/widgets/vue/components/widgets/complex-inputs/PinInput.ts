// ============================================================
// PinInput -- Vue 3 Component
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

export interface PinInputProps {
  /** Number of input cells. */
  length?: number;
  /** Input type: numeric or alphanumeric. */
  type?: 'numeric' | 'alphanumeric';
  /** Mask input like a password field. */
  mask?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Auto-focus the first cell on mount. */
  autoFocus?: boolean;
  /** Placeholder for empty cells. */
  placeholder?: string;
  /** Form field name. */
  name?: string;
  /** Accessible label. */
  label?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Called with the current values array on every input. */
  onChange?: (values: string[]) => void;
  /** Called when all cells are filled. */
  onComplete?: (value: string) => void;
}

export const PinInput = defineComponent({
  name: 'PinInput',

  props: {
    length: { type: Number, default: 6 },
    type: { type: String, default: 'numeric' },
    mask: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    autoFocus: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    name: { type: String },
    label: { type: String, default: 'Verification code' },
    size: { type: String, default: 'md' },
    onChange: { type: Array as PropType<any[]> },
    onComplete: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change', 'complete'],

  setup(props, { slots, emit }) {
    const machine = ref<any>({ completion: 'empty', focus: 'unfocused', });
    const send = (action: any) => { /* state machine dispatch */ };
    const inputRefs = ref<any>([]);
    const focusedIndex = ref<any>(0);
    const emitChange = () => {
    props.onChange?.(valuesRef.value.slice());
    const filled = valuesRef.value.filter(Boolean).length;
    if (filled === props.length) {
      send({ type: 'FILL_ALL' });
      props.onComplete?.(valuesRef.value.join(''));
    } else if (filled === 0) {
      send({ type: 'CLEAR_ALL' });
    }
  };
    const focusCell = (index: number) => {
    const clamped = Math.max(0, Math.min(index, props.length - 1));
    focusedIndex.value = clamped;
    inputRefs.value[clamped]?.focus();
  };
    const filled = valuesRef.value.filter(Boolean).length;
    const clamped = Math.max(0, Math.min(index, props.length - 1));

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.label,
        'aria-roledescription': 'PIN input',
        'data-part': 'root',
        'data-state': machine.value.completion,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'pin-input',
      }, [
        h('label', { 'data-part': 'label', 'data-disabled': props.disabled ? 'true' : 'false' }, [
          props.label,
        ]),
        ...cells.map((index) => h('input', {
            'ref': (el) => { inputRefs.value[index] = el; },
            'role': 'textbox',
            'aria-props': true,
            'label': `Digit ${index + 1} of ${length}`,
            'aria-props': true,
            'required': props.required ? 'true' : 'false',
            'aria-props': true,
            'disabled': props.disabled ? 'true' : 'false',
            'inputmode': props.type === 'numeric' ? 'numeric' : 'text',
            'autocomplete': index === 0 ? 'one-time-code' : 'off',
            'props': true,
            'type': props.mask ? 'password' : 'text',
            'maxlength': 1,
            'pattern': props.type === 'numeric' ? '[0-9]' : '[a-zA-Z0-9]',
            'props': true,
            'placeholder': machine.value.focus === 'focused' && focusedIndex.value === index ? '' : props.placeholder,
            'props': true,
            'disabled': props.disabled,
            'value': valuesRef.value[index],
            'data-part': 'input',
            'data-state': valuesRef.value[index] ? 'filled' : 'empty',
            'data-focused': focusedIndex.value === index && machine.value.focus === 'focused' ? 'true' : 'false',
            'data-index': index,
            'tabindex': focusedIndex.value === index ? 0 : -1,
            'onInput': (e) => {
            const target = e.target as HTMLInputElement;
            const char = target.value.slice(-1);
            target.value = '';
            handleInput(index, char);
          },
            'onFocus': () => {
            focusedIndex.value = index;
            send({ type: 'FOCUS' });
          },
            'onBlur': () => send({ type: 'BLUR' }),
            'onPaste': handlePaste,
            'onKeyDown': (e) => handleKeyDown(e, index),
          })),
        props.name && <input props.type="hidden" props.name={props.name} value={valuesRef.value.join('')} />,
      ]);
  },
});

export default PinInput;