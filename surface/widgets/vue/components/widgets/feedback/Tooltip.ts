// ============================================================
// Tooltip -- Vue 3 Component
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

export interface TooltipProps {
  /** Text label displayed inside the tooltip. */
  label?: string;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** Delay in ms before the tooltip opens. */
  openDelay?: number;
  /** Delay in ms before the tooltip closes. */
  closeDelay?: number;
  /** The trigger element. */
}

export const Tooltip = defineComponent({
  name: 'Tooltip',

  props: {
    label: { type: String, default: '' },
    placement: { type: String, default: 'top' },
    openDelay: { type: Number, default: 700 },
    closeDelay: { type: Number, default: 300 },
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
        'data-state': isVisible ? 'visible' : 'hidden',
        'data-surface-widget': '',
        'data-widget-name': 'tooltip',
      }, [
        h('div', {
          'ref': triggerRef,
          'data-part': 'trigger',
          'aria-describedby': isVisible ? contentId : undefined,
          'onPointerEnter': () => send({ type: 'POINTER_ENTER' }),
          'onPointerLeave': () => send({ type: 'POINTER_LEAVE' }),
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
        }, slots.default?.()),
        isVisible ? h('div', {
            'ref': positionerRef,
            'data-part': 'positioner',
            'data-state': isVisible ? 'visible' : 'hidden',
            'data-placement': position.placement,
            'style': {
            position: 'fixed',
            left: position.x,
            top: position.y,
            pointerEvents: 'none',
          },
          }, [
            h('div', {
              'data-part': 'content',
              'role': 'tooltip',
              'id': contentId,
              'data-state': isVisible ? 'visible' : 'hidden',
              'data-placement': position.placement,
            }, [
              props.label,
            ]),
            h('div', { 'data-part': 'arrow', 'data-placement': position.placement }),
          ]) : null,
      ]);
  },
});

export default Tooltip;