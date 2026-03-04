// ============================================================
// Toast -- Vue 3 Component
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

export interface ToastProps {
  /** Primary notification message. */
  title?: VNode | string;
  /** Optional secondary detail text. */
  description?: VNode | string;
  /** Status variant. */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Auto-dismiss duration in ms. Set 0 to disable. */
  duration?: number;
  /** Whether the toast shows a close button. */
  closable?: boolean;
  /** Icon element rendered in the icon slot. */
  icon?: VNode | string;
  /** Action element (e.g., an undo button). */
  action?: VNode | string;
  /** Callback invoked when the toast should be removed. */
  onDismiss?: () => void;
  /** Callback invoked when the action button is clicked. */
  onAction?: () => void;
}

export const Toast = defineComponent({
  name: 'Toast',

  props: {
    title: { type: null as unknown as PropType<any> },
    description: { type: null as unknown as PropType<any> },
    variant: { type: String, default: 'info' },
    duration: { type: Number, default: 5000 },
    closable: { type: Boolean, default: true },
    icon: { type: null as unknown as PropType<any> },
    action: { type: null as unknown as PropType<any> },
    onDismiss: { type: Function as PropType<(...args: any[]) => any> },
    onAction: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['dismiss'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>('entering');
    const send = (action: any) => { /* state machine dispatch */ };

    if (state.value === 'removed') return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'role': 'status',
        'aria-live': 'polite',
        'aria-atomic': true,
        'aria-labelledby': props.title ? titleId : undefined,
        'aria-describedby': props.description ? descriptionId : undefined,
        'data-part': 'root',
        'data-state': state.value,
        'data-variant': props.variant,
        'data-surface-widget': '',
        'data-widget-name': 'toast',
        'onPointerEnter': () => send({ type: 'POINTER_ENTER' }),
        'onPointerLeave': () => send({ type: 'POINTER_LEAVE' }),
      }, [
        props.icon ? h('span', {
            'data-part': 'icon',
            'data-variant': props.variant,
            'aria-hidden': 'true',
          }, [
            props.icon,
          ]) : null,
        props.title ? h('div', { 'data-part': 'title', 'id': titleId }, [
            props.title,
          ]) : null,
        props.description ? h('div', { 'data-part': 'description', 'id': descriptionId }, [
            props.description,
          ]) : null,
        props.action ? h('div', {
            'data-part': 'action',
            'data-variant': props.variant,
            'onClick': props.onAction,
          }, [
            props.action,
          ]) : null,
        props.closable ? h('button', {
            'type': 'button',
            'data-part': 'close-trigger',
            'aria-label': 'Dismiss notification',
            'onClick': () => send({ type: 'CLOSE' }),
          }, '✕') : null,
      ]);
  },
});

export default Toast;