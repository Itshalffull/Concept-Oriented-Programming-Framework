// ============================================================
// SurfaceRoot — Vue 3 Component
//
// Root component that manages the Clef Surface surface lifecycle.
// Orchestrates the initialization of design tokens, viewport
// observation, and surface-specific setup. Provides a unified
// injection point for all Clef Surface subsystems.
// ============================================================

import {
  defineComponent,
  h,
  ref,
  reactive,
  provide,
  onMounted,
  onUnmounted,
  onErrorCaptured,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue';

import type {
  SurfaceKind,
  DesignTokenValue,
  ThemeConfig,
  ResolvedTheme,
  ViewportState,
  Breakpoint,
} from '../../shared/types.js';

import {
  resolveTheme,
  getBreakpoint,
  getOrientation,
} from '../../shared/surface-bridge.js';

// --- Surface state ---

export type SurfaceLifecycle = 'idle' | 'mounting' | 'ready' | 'error' | 'destroyed';

export interface SurfaceState {
  /** Current lifecycle phase */
  lifecycle: SurfaceLifecycle;
  /** Surface kind (browser-dom, terminal, etc.) */
  kind: SurfaceKind;
  /** Resolved theme */
  theme: ResolvedTheme;
  /** Current viewport state */
  viewport: ViewportState;
  /** Error if lifecycle === 'error' */
  error: Error | null;
}

export const SURFACE_KEY: InjectionKey<SurfaceState> = Symbol('surface-surface');

// --- Component ---

export const SurfaceRoot = defineComponent({
  name: 'SurfaceRoot',

  props: {
    /** What kind of surface this root manages */
    kind: {
      type: String as PropType<SurfaceKind>,
      default: 'browser-dom',
    },
    /** Raw design tokens */
    tokens: {
      type: Array as PropType<DesignTokenValue[]>,
      default: () => [],
    },
    /** Theme configurations */
    themes: {
      type: Array as PropType<ThemeConfig[]>,
      default: () => [],
    },
    /** Custom breakpoint thresholds */
    breakpoints: {
      type: Object as PropType<Record<Breakpoint, number>>,
      default: () => ({
        xs: 0,
        sm: 480,
        md: 768,
        lg: 1024,
        xl: 1280,
      }),
    },
    /** Viewport resize debounce interval (ms) */
    resizeDebounce: {
      type: Number as PropType<number>,
      default: 100,
    },
    /** HTML wrapper tag */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
  },

  emits: {
    /** Emitted when the surface reaches 'ready' lifecycle */
    ready: (_state: SurfaceState) => true,
    /** Emitted on lifecycle errors */
    error: (_error: Error) => true,
    /** Emitted when the surface is destroyed */
    destroyed: () => true,
    /** Emitted when the viewport breakpoint changes */
    'breakpoint-change': (_bp: Breakpoint) => true,
    /** Emitted when the active theme changes */
    'theme-change': (_theme: ResolvedTheme) => true,
  },

  setup(props, { slots, emit }) {
    // --- Resolve theme ---
    const resolvedTheme = reactive<ResolvedTheme>(
      resolveTheme(props.tokens, props.themes),
    );

    // --- Viewport state ---
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    const viewport = reactive<ViewportState>({
      width: initialWidth,
      height: initialHeight,
      breakpoint: getBreakpoint(initialWidth, props.breakpoints),
      orientation: getOrientation(initialWidth, initialHeight),
    });

    // --- Surface state ---
    const lifecycle = ref<SurfaceLifecycle>('idle');
    const surfaceError = ref<Error | null>(null);

    const surfaceState = reactive<SurfaceState>({
      lifecycle: 'idle',
      kind: props.kind,
      theme: resolvedTheme,
      viewport,
      error: null,
    });

    provide(SURFACE_KEY, surfaceState);

    // --- Viewport resize handling ---
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanupResize: (() => void) | null = null;

    function handleResize(): void {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const newBp = getBreakpoint(width, props.breakpoints);
      const prevBp = viewport.breakpoint;

      viewport.width = width;
      viewport.height = height;
      viewport.breakpoint = newBp;
      viewport.orientation = getOrientation(width, height);

      if (newBp !== prevBp) {
        emit('breakpoint-change', newBp);
      }
    }

    function debouncedResize(): void {
      if (resizeTimer) clearTimeout(resizeTimer);
      if (props.resizeDebounce > 0) {
        resizeTimer = setTimeout(handleResize, props.resizeDebounce);
      } else {
        handleResize();
      }
    }

    // --- CSS variables from theme ---
    function buildCssVars(): Record<string, string> {
      const style: Record<string, string> = {};
      for (const [name, value] of Object.entries(resolvedTheme.tokens)) {
        const cssName = `--${name.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        style[cssName] = value;
      }
      return style;
    }

    // --- Lifecycle ---

    onMounted(() => {
      try {
        surfaceState.lifecycle = 'mounting';
        lifecycle.value = 'mounting';

        // Update theme
        const newTheme = resolveTheme(props.tokens, props.themes);
        resolvedTheme.name = newTheme.name;
        for (const key of Object.keys(resolvedTheme.tokens)) {
          delete resolvedTheme.tokens[key];
        }
        Object.assign(resolvedTheme.tokens, newTheme.tokens);

        // Start viewport observation
        if (typeof window !== 'undefined') {
          handleResize();
          window.addEventListener('resize', debouncedResize);
          cleanupResize = () => window.removeEventListener('resize', debouncedResize);
        }

        // Transition to ready
        surfaceState.lifecycle = 'ready';
        lifecycle.value = 'ready';
        emit('ready', { ...surfaceState });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        surfaceState.lifecycle = 'error';
        surfaceState.error = error;
        surfaceError.value = error;
        lifecycle.value = 'error';
        emit('error', error);
      }
    });

    onUnmounted(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      cleanupResize?.();
      surfaceState.lifecycle = 'destroyed';
      lifecycle.value = 'destroyed';
      emit('destroyed');
    });

    // Capture descendant errors
    onErrorCaptured((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      surfaceState.error = error;
      emit('error', error);
      // Return false to stop propagation, true to let it propagate
      return false;
    });

    return (): VNode => {
      // Error state rendering
      if (surfaceState.lifecycle === 'error' && surfaceState.error) {
        return h(
          props.tag,
          {
            class: 'surface-surface-root surface-surface-root--error',
            'data-surface': props.kind,
            'data-lifecycle': 'error',
          },
          slots.error?.({ error: surfaceState.error }) ?? [
            h(
              'div',
              { class: 'surface-surface-root__error', role: 'alert' },
              `Surface error: ${surfaceState.error.message}`,
            ),
          ],
        );
      }

      // Loading state rendering
      if (surfaceState.lifecycle === 'idle' || surfaceState.lifecycle === 'mounting') {
        return h(
          props.tag,
          {
            class: 'surface-surface-root surface-surface-root--loading',
            'data-surface': props.kind,
            'data-lifecycle': surfaceState.lifecycle,
          },
          slots.loading?.() ?? [
            h('div', { class: 'surface-surface-root__loading' }, 'Initializing surface...'),
          ],
        );
      }

      // Ready state
      return h(
        props.tag,
        {
          class: [
            'surface-surface-root',
            'surface-surface-root--ready',
            `surface-surface-root--${props.kind}`,
          ],
          style: buildCssVars(),
          'data-surface': props.kind,
          'data-lifecycle': 'ready',
          'data-theme': resolvedTheme.name,
          'data-breakpoint': viewport.breakpoint,
          'data-orientation': viewport.orientation,
        },
        slots.default?.({
          surface: surfaceState,
          theme: resolvedTheme,
          viewport,
        }),
      );
    };
  },
});

export default SurfaceRoot;
