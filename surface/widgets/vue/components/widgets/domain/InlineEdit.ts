// ============================================================
// InlineEdit -- Vue 3 Component
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

export interface InlineEditProps {
  /** Current value displayed / edited. */
  value: string;
  /** Placeholder when value is empty. */
  placeholder?: string;
  /** Accessible label. */
  ariaLabel?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Whether the field is disabled. */
  disabled?: boolean;
  /** Show confirm/cancel buttons. */
  showButtons?: boolean;
  /** Maximum character length. */
  maxLength?: number;
  /** Select text on focus. */
  selectOnFocus?: boolean;
  /** Submit on blur. */
  submitOnBlur?: boolean;
  /** Called when a new value is confirmed. */
  onConfirm?: (value: string) => void;
  /** Called when editing is cancelled. */
  onCancel?: () => void;
  /** Render prop for the edit button icon. */
  editIcon?: VNode | string;
}

export const InlineEdit = defineComponent({
  name: 'InlineEdit',

  props: {
    value: { type: String, required: true as const },
    placeholder: { type: String, default: 'Click to edit' },
    ariaLabel: { type: String, default: 'Editable field' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    showButtons: { type: Boolean, default: false },
    maxLength: { type: Number },
    selectOnFocus: { type: Boolean, default: true },
    submitOnBlur: { type: Boolean, default: true },
    onConfirm: { type: Function as PropType<(...args: any[]) => any> },
    onCancel: { type: Function as PropType<(...args: any[]) => any> },
    editIcon: { type: null as unknown as PropType<any> },
  },

  emits: ['confirm', 'cancel'],

  setup(props, { slots, emit }) {
    const state = ref<any>('displaying');
    const send = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const editValueRef = ref<any>(props.value);
    const handleConfirm = () => {
    const newVal = editValueRef.value;
    if (props.required && !newVal.trim()) return;
    props.onConfirm?.(newVal);
    send({ type: 'CONFIRM' });
  };
    const handleCancel = () => {
    editValueRef.value = props.value;
    props.onCancel?.();
    send({ type: 'CANCEL' });
  };
    const newVal = editValueRef.value;

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'inline editor',
        'data-surface-widget': '',
        'data-widget-name': 'inline-edit',
        'data-state': isEditing ? 'editing' : 'displaying',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-empty': !props.value ? 'true' : 'false',
      }, [
        !isEditing ? h('div', {
            'role': 'button',
            'aria-label': `${ariaLabel}: ${value || placeholder}. Click to edit.`,
            'data-part': 'display',
            'data-visible': 'true',
            'data-empty': !props.value ? 'true' : 'false',
            'tabindex': props.disabled ? -1 : 0,
            'onClick': () => !props.disabled && send({ type: 'ACTIVATE' }),
            'onKeyDown': handleDisplayKeyDown,
            'onFocus': () => send({ type: 'FOCUS' }),
            'onBlur': () => send({ type: 'BLUR' }),
          }, [
            h('span', { 'data-part': 'display-text', 'data-placeholder': !props.value ? 'true' : 'false' }, [
              props.value || props.placeholder,
            ]),
          ]) : null,
        props.showButtons && !isEditing && !props.disabled ? h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': `Edit ${ariaLabel}`,
            'data-part': 'edit-button',
            'data-visible': 'true',
            'tabindex': -1,
            'onClick': () => send({ type: 'ACTIVATE' }),
          }, [
            props.editIcon ?? '\u270E',
          ]) : null,
        isEditing ? [
            h('input', {
              'ref': inputRef,
              'type': 'text',
              'data-part': 'input',
              'data-visible': 'true',
              'defaultValue': props.value,
              'placeholder': props.placeholder,
              'maxlength': props.maxLength,
              'aria-label': props.ariaLabel,
              'aria-required': props.required || undefined,
              'onChange': (e) => { editValueRef.value = e.target.value; },
              'onKeyDown': handleInputKeyDown,
              'onBlur': () => props.submitOnBlur ? handleConfirm() : handleCancel(),
            }),
            props.showButtons ? [
                h('button', {
                  'type': 'button',
                  'role': 'button',
                  'aria-label': 'Confirm edit',
                  'data-part': 'confirm',
                  'data-visible': 'true',
                  'tabindex': -1,
                  'onClick': handleConfirm,
                }, '&#x2713;'),
                h('button', {
                  'type': 'button',
                  'role': 'button',
                  'aria-label': 'Cancel edit',
                  'data-part': 'cancel',
                  'data-visible': 'true',
                  'tabindex': -1,
                  'onClick': handleCancel,
                }, '✕'),
              ] : null,
          ] : null,
      ]);
  },
});

export default InlineEdit;