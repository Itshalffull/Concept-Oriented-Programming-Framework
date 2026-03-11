// ============================================================
// Dialog -- Vue 3 Component
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

export interface DialogProps {
  /** Controlled open state. */
  open?: boolean;
  /** Whether clicking the backdrop closes the dialog. */
  closeOnOutsideClick?: boolean;
  /** Whether pressing Escape closes the dialog. */
  closeOnEscape?: boolean;
  /** ARIA role override. */
  dialogRole?: 'dialog' | 'alertdialog';
  /** Callback when the dialog requests to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title. */
  title?: VNode | string;
  /** Dialog description. */
  description?: VNode | string;
  /** Dialog body content. */
}

export const Dialog = defineComponent({
  name: 'Dialog',

  props: {
    open: { type: Boolean },
    closeOnOutsideClick: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
    dialogRole: { type: String, default: 'dialog' },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    title: { type: null as unknown as PropType<any> },
    description: { type: null as unknown as PropType<any> },
  },

  emits: ['open-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>('closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleOverlayClick = (e: any) => {
      if ((e as any).target === (e as any).currentTarget && props.closeOnOutsideClick) {
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
        'data-role': props.dialogRole,
        'data-surface-widget': '',
        'data-widget-name': 'dialog',
        'onClick': handleOverlayClick,
      }, [
        h('div', { 'data-part': 'positioner', 'data-state': 'open' }, [
          h('div', {
            'data-part': 'content',
            'role': props.dialogRole,
            'aria-modal': true,
            'aria-labelledby': props.title ? titleId : undefined,
            'aria-describedby': props.description ? descriptionId : undefined,
            'data-state': 'open',
          }, [
            props.title ? h('div', { 'data-part': 'title', 'id': titleId }, [
                props.title,
              ]) : null,
            props.description ? h('div', { 'data-part': 'description', 'id': descriptionId }, [
                props.description,
              ]) : null,
            slots.default?.(),
            h('button', {
              'type': 'button',
              'data-part': 'close-trigger',
              'aria-label': 'Close',
              'onClick': handleClose,
            }, '✕'),
          ]),
        ]),
      ])
      ]);
  },
});

export default Dialog;