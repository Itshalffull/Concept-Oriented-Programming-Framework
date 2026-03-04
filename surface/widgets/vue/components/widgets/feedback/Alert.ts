// ============================================================
// Alert -- Vue 3 Component
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

export interface AlertProps {
  /** Status variant controlling icon and ARIA role. */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Whether the alert can be dismissed by the user. */
  closable?: boolean;
  /** Primary alert message. */
  title?: VNode | string;
  /** Optional secondary detail or guidance text. */
  description?: VNode | string;
  /** Icon element rendered in the icon slot. */
  icon?: VNode | string;
  /** Callback invoked when the alert is dismissed. */
  onDismiss?: () => void;
}

export const Alert = defineComponent({
  name: 'Alert',

  props: {
    variant: { type: String, default: 'info' },
    closable: { type: Boolean, default: false },
    title: { type: null as unknown as PropType<any> },
    description: { type: null as unknown as PropType<any> },
    icon: { type: null as unknown as PropType<any> },
    onDismiss: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['dismiss'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>('visible');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleDismiss = () => {
    send({ type: 'DISMISS' });
    props.onDismiss?.();
  };

    if (state.value === 'dismissed') return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'role': role,
        'aria-live': ariaLive,
        'aria-atomic': true,
        'aria-labelledby': props.title ? titleId : undefined,
        'aria-describedby': props.description ? descriptionId : undefined,
        'data-part': 'root',
        'data-state': state.value,
        'data-variant': props.variant,
        'data-surface-widget': '',
        'data-widget-name': 'alert',
      }, [
        props.icon ? h('span', {
            'data-part': 'icon',
            'data-variant': props.variant,
            'aria-hidden': 'true',
          }, [
            props.icon,
          ]) : null,
        h('div', { 'data-part': 'content', 'data-variant': props.variant }, [
          props.title ? h('div', { 'data-part': 'title', 'id': titleId }, [
              props.title,
            ]) : null,
          props.description ? h('div', { 'data-part': 'description', 'id': descriptionId }, [
              props.description,
            ]) : null,
          slots.default?.(),
        ]),
        props.closable ? h('button', {
            'type': 'button',
            'data-part': 'close-trigger',
            'aria-label': 'Dismiss alert',
            'onClick': handleDismiss,
          }, '✕') : null,
      ]);
  },
});

export default Alert;