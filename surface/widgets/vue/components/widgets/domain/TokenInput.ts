// ============================================================
// TokenInput -- Vue 3 Component
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

export interface TokenInputProps {
  /** Display label. */
  label: string;
  /** Data type of the token. */
  type?: string;
  /** Whether the token can be removed. */
  removable?: boolean;
  /** Whether the token is disabled. */
  disabled?: boolean;
  /** Color for the token pill. */
  color?: string;
  /** Internal value. */
  value?: string;
  /** Unique ID. */
  id?: string;
  /** Called on remove. */
  onRemove?: () => void;
  /** Called on select. */
  onSelect?: () => void;
  /** Type icon slot. */
  typeIcon?: VNode | string;
  /** Remove button icon. */
  removeIcon?: VNode | string;
}

export const TokenInput = defineComponent({
  name: 'TokenInput',

  props: {
    label: { type: String, required: true as const },
    type: { type: String },
    removable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    color: { type: String },
    value: { type: String },
    id: { type: String },
    onRemove: { type: Function as PropType<(...args: any[]) => any> },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    typeIcon: { type: null as unknown as PropType<any> },
    removeIcon: { type: null as unknown as PropType<any> },
  },

  emits: ['remove', 'select'],

  setup(props, { slots, emit }) {
    const state = ref<any>('static');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('span', {
        'role': 'option',
        'aria-label': ariaLabel,
        'aria-roledescription': 'token',
        'aria-selected': state.value === 'selected' || undefined,
        'aria-disabled': props.disabled || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'token-input',
        'data-part': 'token',
        'data-type': props.type,
        'data-state': state.value,
        'data-removable': props.removable ? 'true' : 'false',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-color': props.color,
        'tabindex': props.disabled ? -1 : 0,
        'onClick': () => { if (!props.disabled) { send({ type: 'SELECT' }); props.onSelect?.(); } },
        'onPointerEnter': () => send({ type: 'HOVER' }),
        'onPointerLeave': () => send({ type: 'UNHOVER' }),
        'onFocus': () => send({ type: 'FOCUS' }),
        'onBlur': () => send({ type: 'BLUR' }),
        'onKeyDown': handleKeyDown,
      }, [
        props.type ? h('span', {
            'data-part': 'type-icon',
            'data-type': props.type,
            'data-visible': 'true',
            'aria-hidden': !props.type || undefined,
            'aria-label': props.type ? `Type: ${type}` : '',
          }, [
            props.typeIcon,
          ]) : null,
        h('span', { 'data-part': 'label' }, [
          props.label,
        ]),
        props.removable && !props.disabled ? h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': `Remove ${label} token`,
            'data-part': 'remove',
            'data-visible': 'true',
            'tabindex': -1,
            'onClick': (e) => { e.stopPropagation(); props.onRemove?.(); },
          }, [
            props.removeIcon ?? '\u2715',
          ]) : null,
      ]);
  },
});

export default TokenInput;