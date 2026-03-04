// ============================================================
// ScrollLock -- Vue 3 Component
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

export interface ScrollLockProps {
  active?: boolean;
  preserveScrollbarGap?: boolean;
}

export const ScrollLock = defineComponent({
  name: 'ScrollLock',

  props: {
    active: { type: Boolean, default: false },
    preserveScrollbarGap: { type: Boolean, default: true },
  },

  setup(props, { slots, emit }) {
    const scrollPositionRef = ref<any>(0);
    onMounted(() => {
      if (!props.active) return;
      
      // Save scroll position
      scrollPositionRef.value = window.scrollY;
      
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      
      // Preserve scrollbar gap to prevent layout shift
      if (props.preserveScrollbarGap) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      }
    });
    onUnmounted(() => {
      // Restore body scroll
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      
      // Restore scroll position
      window.scrollTo(0, scrollPositionRef.value);
    });

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'scroll-lock',
        'data-part': 'root',
        'data-state': props.active ? 'locked' : 'unlocked',
        'data-scroll-lock': props.active ? 'true' : 'false',
        'data-preserve-gap': props.preserveScrollbarGap ? 'true' : 'false',
      }, slots.default?.());
  },
});

export default ScrollLock;