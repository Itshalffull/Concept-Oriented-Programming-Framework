// ============================================================
// ViewportProvider — Vue 3 Component
//
// Provide/inject viewport state (width, height, breakpoint,
// orientation) to descendant components. Watches window resize
// events and updates the reactive state accordingly.
// ============================================================

import {
  defineComponent,
  h,
  reactive,
  provide,
  onMounted,
  onUnmounted,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue';

import type { ViewportState, Breakpoint } from '../../shared/types.js';

import {
  getBreakpoint,
  getOrientation,
} from '../../shared/surface-bridge.js';

// --- Injection Key ---

export const VIEWPORT_KEY: InjectionKey<ViewportState> = Symbol('surface-viewport');

// --- Default breakpoints ---

const DEFAULT_BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// --- Component ---

export const ViewportProvider = defineComponent({
  name: 'ViewportProvider',

  props: {
    /** Custom breakpoint thresholds */
    breakpoints: {
      type: Object as PropType<Record<string, number>>,
      default: () => ({ ...DEFAULT_BREAKPOINTS }),
    },
    /** Debounce interval for resize events (ms) */
    debounce: {
      type: Number as PropType<number>,
      default: 100,
      validator: (v: unknown) => typeof v === 'number' && v >= 0,
    },
    /** HTML wrapper tag */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
  },

  emits: {
    /** Emitted when breakpoint changes */
    'breakpoint-change': (bp: Breakpoint) => typeof bp === 'string',
    /** Emitted on each (debounced) resize */
    resize: (state: ViewportState) => !!state,
  },

  setup(props, { slots, emit }) {
    // Initial values (SSR-safe defaults)
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    const state = reactive<ViewportState>({
      width: initialWidth,
      height: initialHeight,
      breakpoint: getBreakpoint(initialWidth, props.breakpoints),
      orientation: getOrientation(initialWidth, initialHeight),
    });

    provide(VIEWPORT_KEY, state);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanupResize: (() => void) | null = null;

    function handleResize(): void {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const newBreakpoint = getBreakpoint(width, props.breakpoints);
      const prevBreakpoint = state.breakpoint;

      state.width = width;
      state.height = height;
      state.breakpoint = newBreakpoint;
      state.orientation = getOrientation(width, height);

      emit('resize', { ...state });

      if (newBreakpoint !== prevBreakpoint) {
        emit('breakpoint-change', newBreakpoint);
      }
    }

    function debouncedResize(): void {
      if (resizeTimer) clearTimeout(resizeTimer);
      if (props.debounce > 0) {
        resizeTimer = setTimeout(handleResize, props.debounce);
      } else {
        handleResize();
      }
    }

    onMounted(() => {
      if (typeof window === 'undefined') return;

      // Set initial values from actual window
      handleResize();

      window.addEventListener('resize', debouncedResize);
      cleanupResize = () => window.removeEventListener('resize', debouncedResize);
    });

    onUnmounted(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      cleanupResize?.();
    });

    return (): VNode =>
      h(
        props.tag,
        {
          class: 'surface-viewport-provider',
          'data-breakpoint': state.breakpoint,
          'data-orientation': state.orientation,
        },
        slots.default?.(),
      );
  },
});

export default ViewportProvider;
