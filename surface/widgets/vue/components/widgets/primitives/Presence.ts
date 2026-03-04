// ============================================================
// Presence -- Vue 3 Component
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

export interface PresenceProps {
  present?: boolean;
  animateOnMount?: boolean;
  forceMount?: boolean;
}

export const Presence = defineComponent({
  name: 'Presence',

  props: {
    present: { type: Boolean, default: false },
    animateOnMount: { type: Boolean, default: false },
    forceMount: { type: Boolean, default: false },
  },

  setup(props, { slots, emit }) {
    const state = ref<any>(props.present ? (props.animateOnMount ? 'mounting' : 'mounted') : 'unmounted');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleAnimationEnd = () => {
      send({ type: 'ANIMATION_END' });
    };
    const shouldRender = props.forceMount || state.value !== 'unmounted';
    onMounted(() => {
      if (props.present) {
      send({ type: 'SHOW' });
      } else {
      send({ type: 'HIDE' });
      }
    });

    if (!shouldRender) return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'onAnimationEnd': handleAnimationEnd,
        'onTransitionEnd': handleAnimationEnd,
        'data-surface-widget': '',
        'data-widget-name': 'presence',
        'data-part': 'root',
        'data-state': stateToDataState(state.value),
        'data-present': props.present ? 'true' : 'false',
        'data-animate-mount': props.animateOnMount ? 'true' : 'false',
        'data-force-mount': props.forceMount ? 'true' : 'false',
      }, slots.default?.());
  },
});

export default Presence;