// ============================================================
// Drawer -- Vue 3 Component
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
  Teleport,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface DrawerProps {
  /** Controlled open state. */
  open?: boolean;
  /** Edge from which the drawer slides in. */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  /** Size preset for the drawer panel. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when the drawer requests to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Content rendered inside the drawer header region. */
  header?: VNode | string;
  /** Content rendered inside the drawer footer region. */
  footer?: VNode | string;
  /** Main body content. */
}

export const Drawer = defineComponent({
  name: 'Drawer',

  props: {
    open: { type: Boolean },
    placement: { type: String, default: 'right' },
    size: { type: String, default: 'md' },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    header: { type: null as unknown as PropType<any> },
    footer: { type: null as unknown as PropType<any> },
  },

  emits: ['open-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>('closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleOverlayClick = (e: any) => {
      if ((e as any).target === (e as any).currentTarget) {
        send({ type: 'OUTSIDE_CLICK' });
        props.onOpenChange?.(false);
      }
    };

  const handleClose = () => {
    send({ type: 'CLOSE' });
    props.onOpenChange?.(false);
  };

    if (!isOpen) return () => null as unknown as VNode;
    return (): VNode =>
      h(Teleport as any, { to: 'body' }, [
        h('div', {
        'data-part': 'backdrop',
        'data-state': 'open',
        'data-placement': props.placement,
        'data-surface-widget': '',
        'data-widget-name': 'drawer',
        'onClick': handleOverlayClick,
      }, [
        h('div', {
          'data-part': 'content',
          'role': 'dialog',
          'aria-modal': true,
          'aria-labelledby': headerId,
          'data-state': 'open',
          'data-placement': props.placement,
          'data-size': props.size,
        }, [
          h('div', { 'data-part': 'header', 'id': headerId }, [
            props.header,
            h('button', {
              'type': 'button',
              'data-part': 'close-trigger',
              'aria-label': 'Close drawer',
              'onClick': handleClose,
            }, '✕'),
          ]),
          h('div', {
            'data-part': 'body',
            'id': bodyId,
            'tabindex': 0,
            'role': 'document',
          }, slots.default?.()),
          props.footer ? h('div', { 'data-part': 'footer', 'data-placement': props.placement }, [
              props.footer,
            ]) : null,
        ]),
      ])
      ]);
  },
});

export default Drawer;