// ============================================================
// HoverCard -- Vue 3 Component
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

export interface HoverCardProps {
  /** Delay in ms before the card opens. */
  openDelay?: number;
  /** Delay in ms before the card closes. */
  closeDelay?: number;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** The trigger element that reveals the hover card. */
  /** Content displayed inside the hover card. */
  content?: VNode | string;
}

export const HoverCard = defineComponent({
  name: 'HoverCard',

  props: {
    openDelay: { type: Number, default: 700 },
    closeDelay: { type: Number, default: 300 },
    placement: { type: String, default: 'bottom' },
    content: { type: null as unknown as PropType<any> },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>('hidden');
    const send = (action: any) => { /* state machine dispatch */ };
    const triggerRef = ref<any>(null);
    const positionerRef = ref<any>(null);
    const clearTimer = () => {
    if (timerRef.value !== null) {
      clearTimeout(timerRef.value);
      timerRef.value = null;
    }
  };

    return (): VNode =>
      h('div', {
        'data-part': 'root',
        'data-state': state.value,
        'data-surface-widget': '',
        'data-widget-name': 'hover-card',
      }, [
        h('div', {
          'ref': triggerRef,
          'data-part': 'trigger',
          'aria-haspopup': 'dialog',
          'aria-expanded': isOpen,
          'aria-controls': isOpen ? contentId : undefined,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
        }, slots.default?.()),
        isOpen ? h('div', {
            'ref': positionerRef,
            'data-part': 'positioner',
            'data-state': state.value,
            'data-placement': position.placement,
            'style': {
            position: 'fixed',
            left: position.x,
            top: position.y,
          },
          }, [
            h('div', {
              'data-part': 'content',
              'role': 'dialog',
              'aria-modal': false,
              'id': contentId,
              'data-state': state.value,
              'data-placement': position.placement,
            }, [
              props.content,
            ]),
            h('div', { 'data-part': 'arrow', 'data-placement': position.placement }),
          ]) : null,
      ]);
  },
});

export default HoverCard;