// ============================================================
// Popover -- Vue 3 Component
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

export interface PopoverProps {
  /** Controlled open state. */
  open?: boolean;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** Whether clicking outside closes the popover. */
  closeOnOutsideClick?: boolean;
  /** Whether pressing Escape closes the popover. */
  closeOnEscape?: boolean;
  /** Callback when the popover requests to close. */
  onOpenChange?: (open: boolean) => void;
  /** Trigger element. */
  trigger?: VNode | string;
  /** Optional popover title. */
  title?: VNode | string;
  /** Optional popover description. */
  description?: VNode | string;
  /** Content inside the popover. */
}

export const Popover = defineComponent({
  name: 'Popover',

  props: {
    open: { type: Boolean },
    placement: { type: String, default: 'bottom' },
    closeOnOutsideClick: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    trigger: { type: null as unknown as PropType<any> },
    title: { type: null as unknown as PropType<any> },
    description: { type: null as unknown as PropType<any> },
  },

  emits: ['open-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>('closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const triggerRef = ref<any>(null);
    const positionerRef = ref<any>(null);
    const contentRef = ref<any>(null);
    const handleToggle = () => {
    const next = !isOpen;
    send({ type: 'TRIGGER_CLICK' });
    props.onOpenChange?.(next);
  };
    const handleClose = () => {
    send({ type: 'CLOSE' });
    props.onOpenChange?.(false);
  };
    const next = !isOpen;

    return (): VNode =>
      h('div', {
        'data-part': 'root',
        'data-state': isOpen ? 'open' : 'closed',
        'data-surface-widget': '',
        'data-widget-name': 'popover',
      }, [
        h('button', {
          'ref': triggerRef,
          'type': 'button',
          'data-part': 'trigger',
          'aria-haspopup': 'dialog',
          'aria-expanded': isOpen,
          'aria-controls': isOpen ? contentId : undefined,
          'onClick': handleToggle,
        }, [
          props.trigger,
        ]),
        isOpen ? h('div', {
            'ref': positionerRef,
            'data-part': 'positioner',
            'data-state': 'open',
            'data-placement': position.placement,
            'style': {
            position: 'fixed',
            left: position.x,
            top: position.y,
          },
          }, [
            h('div', {
              'ref': contentRef,
              'data-part': 'content',
              'role': 'dialog',
              'aria-modal': false,
              'aria-labelledby': props.title ? titleId : undefined,
              'aria-describedby': props.description ? descriptionId : undefined,
              'id': contentId,
              'data-state': 'open',
              'data-placement': position.placement,
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
                'aria-label': 'Close popover',
                'onClick': handleClose,
              }, '✕'),
            ]),
            h('div', { 'data-part': 'arrow', 'data-placement': position.placement }),
          ]) : null,
      ]);
  },
});

export default Popover;