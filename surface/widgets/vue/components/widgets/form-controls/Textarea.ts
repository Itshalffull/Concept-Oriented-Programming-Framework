// ============================================================
// Textarea -- Vue 3 Component
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

export interface TextareaProps {
  /** Current value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Number of visible rows */
  rows?: number;
  /** Auto-resize to fit content */
  autoResize?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Visible label */
  label: string;
  /** Helper text */
  description?: string;
  /** Error message (renders when validation is invalid) */
  error?: string;
  /** Read-only state */
  readOnly?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Change callback */
  onChange?: (value: string) => void;
}

export const Textarea = defineComponent({
  name: 'Textarea',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    rows: { type: Number, default: 3 },
    autoResize: { type: Boolean, default: true },
    maxLength: { type: Number },
    label: { type: String, required: true as const },
    description: { type: String },
    error: { type: String },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    name: { type: null as unknown as PropType<any>, required: true as const },
    placeholder: { type: String, default: '' },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const contentState = ref<any>(value.length > 0 ? 'filled' : 'empty',);
    const dispatchContent = (action: any) => { /* state machine dispatch */ };
    const focusState = ref<any>('idle');
    const dispatchFocus = (action: any) => { /* state machine dispatch */ };
    const validationState = ref<any>(props.error ? 'invalid' : 'valid',);
    const dispatchValidation = (action: any) => { /* state machine dispatch */ };
    const textareaRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };
    const el = textareaRef.value;

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'textarea',
        'data-part': 'root',
        'data-state': focusState.value === 'focused' ? 'focused' : 'idle',
        'data-content': contentState.value,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-invalid': isInvalid ? 'true' : 'false',
        'data-size': props.size,
      }, [
        h('label', { 'data-part': 'label', 'for': uid }, [
          props.label,
        ]),
        h('textarea', {
          'ref': setTextareaRef,
          'id': uid,
          'data-part': 'textarea',
          'value': value,
          'rows': props.rows,
          'placeholder': props.placeholder,
          'disabled': props.disabled,
          'readonly': props.readOnly,
          'required': props.required,
          'name': props.name,
          'maxlength': props.maxLength,
          'aria-label': props.label,
          'aria-describedby': props.description ? descriptionId : undefined,
          'aria-invalid': isInvalid ? 'true' : 'false',
          'aria-errormessage': isInvalid ? errorId : undefined,
          'aria-multiline': 'true',
          'aria-placeholder': props.placeholder || undefined,
          'style': {
          resize: props.autoResize ? 'none' : 'vertical',
          overflow: props.autoResize ? 'hidden' : 'auto',
        },
          'onChange': handleInput,
          'onFocus': () => dispatchFocus({ type: 'FOCUS' }),
          'onBlur': () => dispatchFocus({ type: 'BLUR' }),
        }),
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
        props.maxLength !== undefined ? h('span', { 'data-part': 'charCount', 'aria-live': 'polite' }, [
            value.length,
            '/',
            props.maxLength,
          ]) : null,
      ]);
  },
});

export default Textarea;