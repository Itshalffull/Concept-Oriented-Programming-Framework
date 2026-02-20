// ============================================================
// MotionBox — Vue 3 Component
//
// Container that applies CSS transitions from COIF motion
// configuration. Watches the prefers-reduced-motion media
// query and suppresses animations when the user requests it.
// ============================================================

import {
  defineComponent,
  h,
  ref,
  computed,
  onMounted,
  onUnmounted,
  type PropType,
  type VNode,
} from 'vue';

import type {
  MotionTransition,
  MotionDuration,
  MotionEasing,
} from '../../shared/types.js';

import { motionToCSS } from '../../shared/coif-bridge.js';

export const MotionBox = defineComponent({
  name: 'MotionBox',

  props: {
    /** Named transition definitions to apply */
    transitions: {
      type: Array as PropType<MotionTransition[]>,
      default: () => [],
    },
    /** Duration tokens available */
    durations: {
      type: Array as PropType<MotionDuration[]>,
      default: () => [],
    },
    /** Easing tokens available */
    easings: {
      type: Array as PropType<MotionEasing[]>,
      default: () => [],
    },
    /** HTML wrapper tag */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
    /** Force reduced motion regardless of OS preference */
    forceReducedMotion: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    /** Additional inline styles */
    extraStyle: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
  },

  emits: {
    /** Emitted when the reduced-motion preference changes */
    'reduced-motion-change': (prefersReduced: boolean) => typeof prefersReduced === 'boolean',
  },

  setup(props, { slots, emit }) {
    // Track OS-level prefers-reduced-motion
    const prefersReducedMotion = ref(false);
    let mediaQuery: MediaQueryList | null = null;

    function onMediaChange(event: MediaQueryListEvent): void {
      prefersReducedMotion.value = event.matches;
      emit('reduced-motion-change', event.matches);
    }

    onMounted(() => {
      if (typeof window === 'undefined') return;

      mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion.value = mediaQuery.matches;

      // Use addEventListener (modern) with fallback to addListener (legacy)
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', onMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(onMediaChange);
      }
    });

    onUnmounted(() => {
      if (!mediaQuery) return;
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', onMediaChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(onMediaChange);
      }
    });

    const isReduced = computed(() =>
      props.forceReducedMotion || prefersReducedMotion.value,
    );

    const transitionCSS = computed<string>(() => {
      if (isReduced.value) return 'none';

      return props.transitions
        .map((t) => motionToCSS(t, props.durations, props.easings))
        .join(', ');
    });

    const style = computed<Record<string, string>>(() => ({
      transition: transitionCSS.value,
      ...props.extraStyle,
    }));

    return (): VNode =>
      h(
        props.tag,
        {
          class: [
            'coif-motion-box',
            { 'coif-motion-box--reduced': isReduced.value },
          ],
          style: style.value,
          'data-reduced-motion': isReduced.value ? 'true' : 'false',
        },
        slots.default?.(),
      );
  },
});

export default MotionBox;
