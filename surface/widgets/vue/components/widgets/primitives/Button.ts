// ============================================================
// Button -- Vue 3 Component
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

export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  iconPosition?: 'start' | 'end';
  onClick?: () => void;
}

export const Button = defineComponent({
  name: 'Button',

  props: {
    variant: { type: String, default: 'filled' },
    size: { type: String, default: 'md' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    type: { type: String, default: 'button' },
    iconPosition: { type: String, default: 'start' },
    onClick: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['click'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleClick = () => {
      if (!props.disabled && !props.loading) props.onClick?.();
    };
    const dataState = props.loading ? 'loading' : props.disabled ? 'disabled' : state.value;

    return (): VNode =>
      h('button', {
        'type': props.type,
        'disabled': props.disabled || props.loading,
        'onClick': handleClick,
        'onMouseEnter': () => send({ type: 'HOVER' }),
        'onMouseLeave': () => send({ type: 'UNHOVER' }),
        'onFocus': () => send({ type: 'FOCUS' }),
        'onBlur': () => send({ type: 'BLUR' }),
        'onPointerDown': () => send({ type: 'PRESS' }),
        'onPointerUp': () => send({ type: 'RELEASE' }),
        'role': 'button',
        'aria-disabled': props.disabled || props.loading,
        'aria-busy': props.loading,
        'tabindex': props.disabled ? -1 : 0,
        'data-surface-widget': '',
        'data-widget-name': 'button',
        'data-part': 'root',
        'data-state': dataState,
        'data-variant': props.variant,
        'data-size': props.size,
      }, [
        props.loading ? h('span', {
            'data-part': 'spinner',
            'aria-hidden': !props.loading,
            'data-visible': props.loading,
          }) : null,
        h('span', {
          'data-part': 'icon',
          'data-position': props.iconPosition,
          'aria-hidden': 'true',
        }),
        h('span', { 'data-part': 'label', 'data-size': props.size }, slots.default?.()),
      ]);
  },
});

export default Button;