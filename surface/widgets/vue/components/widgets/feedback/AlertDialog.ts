// ============================================================
// AlertDialog -- Vue 3 Component
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

export interface AlertDialogProps {
  /** Controlled open state. */
  open?: boolean;
  /** Callback when the dialog requests to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Callback invoked when the user confirms. */
  onConfirm?: () => void;
  /** Callback invoked when the user cancels. */
  onCancel?: () => void;
  /** Alert dialog title. */
  title?: VNode | string;
  /** Alert dialog description explaining the action and consequences. */
  description?: VNode | string;
  /** Custom cancel button content. */
  cancelLabel?: VNode | string;
  /** Custom confirm button content. */
  confirmLabel?: VNode | string;
  /** Dialog body content. */
}

export const AlertDialog = defineComponent({
  name: 'AlertDialog',

  props: {
    open: { type: Boolean },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    onConfirm: { type: Function as PropType<(...args: any[]) => any> },
    onCancel: { type: Function as PropType<(...args: any[]) => any> },
    title: { type: null as unknown as PropType<any> },
    description: { type: null as unknown as PropType<any> },
    cancelLabel: { type: String, default: 'Cancel' },
    confirmLabel: { type: String, default: 'Confirm' },
  },

  emits: ['cancel', 'open-change', 'confirm'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>('closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const cancelRef = ref<any>(null);
    const handleCancel = () => {
    send({ type: 'CANCEL' });
    props.onCancel?.();
    props.onOpenChange?.(false);
  };
    const handleConfirm = () => {
    send({ type: 'CONFIRM' });
    props.onConfirm?.();
    props.onOpenChange?.(false);
  };

    if (!isOpen) return () => null as unknown as VNode;
    return (): VNode =>
      h(Teleport as any, { to: 'body' }, [
        h('div', {
        'data-part': 'backdrop',
        'data-state': 'open',
        'data-role': 'alertdialog',
        'data-surface-widget': '',
        'data-widget-name': 'alert-dialog',
        'aria-hidden': true,
      }, [
        h('div', { 'data-part': 'positioner', 'data-state': 'open' }, [
          h('div', {
            'data-part': 'content',
            'role': 'alertdialog',
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
            h('div', { 'data-part': 'actions' }, [
              h('button', {
                'ref': cancelRef,
                'type': 'button',
                'data-part': 'cancel',
                'aria-label': 'Cancel',
                'onClick': handleCancel,
              }, [
                props.cancelLabel,
              ]),
              h('button', {
                'type': 'button',
                'data-part': 'confirm',
                'aria-label': 'Confirm',
                'onClick': handleConfirm,
              }, [
                props.confirmLabel,
              ]),
            ]),
          ]),
        ]),
      ])
      ]);
  },
});

export default AlertDialog;