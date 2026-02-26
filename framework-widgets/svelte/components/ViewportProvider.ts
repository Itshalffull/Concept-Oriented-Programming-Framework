// ============================================================
// ViewportProvider — Svelte-compatible Clef Surface component
//
// Observes viewport size via ResizeObserver / window resize
// and provides breakpoint state to descendant components.
// Implements a context-like pattern so child components can
// reactively access the current viewport dimensions and
// breakpoint classification.
// ============================================================

import type {
  ViewportState,
  Breakpoint,
  WritableSignal,
  Signal,
} from '../../shared/types.js';

import {
  createViewportSignal,
  observeViewport,
  getBreakpoint,
  getOrientation,
} from '../../shared/surface-bridge.js';

// --- Context registry (module-scoped, mirrors Svelte setContext/getContext) ---

const viewportContextRegistry = new Map<HTMLElement, ViewportContext>();

export interface ViewportContext {
  readonly viewport: Signal<ViewportState>;
  readonly breakpoint: Breakpoint;
}

export function getViewportContext(node: HTMLElement): ViewportContext | undefined {
  let current: HTMLElement | null = node;
  while (current) {
    const ctx = viewportContextRegistry.get(current);
    if (ctx) return ctx;
    current = current.parentElement;
  }
  return undefined;
}

// --- Component types ---

export interface ViewportProviderProps {
  breakpoints?: Record<string, number>;
  debounceMs?: number;
  className?: string;
  'on:breakpointchange'?: (event: { state: ViewportState; previous: Breakpoint }) => void;
}

export interface ViewportProviderInstance {
  update(props: Partial<ViewportProviderProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  readonly viewportSignal: Signal<ViewportState>;
  getCurrentState(): ViewportState;
}

export interface ViewportProviderOptions {
  target: HTMLElement;
  props: ViewportProviderProps;
}

// --- Debounce utility ---

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T & { cancel(): void };
  debounced.cancel = () => { if (timer) clearTimeout(timer); };
  return debounced;
}

// --- Component factory ---

export function createViewportProvider(
  options: ViewportProviderOptions,
): ViewportProviderInstance {
  const { target } = options;
  let {
    breakpoints,
    debounceMs = 100,
    className,
  } = options.props;
  let onBreakpointChange = options.props['on:breakpointchange'];

  // Container element
  const container = document.createElement('div');
  container.setAttribute('data-surface-viewport-provider', '');
  if (className) container.className = className;
  target.appendChild(container);

  // Create viewport signal — mirrors $state
  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const viewport$ = createViewportSignal(initialWidth, initialHeight);

  // Track previous breakpoint for change detection
  let previousBreakpoint = viewport$.get().breakpoint;

  // Subscribe to viewport changes — mirrors $derived / $effect
  const unsubscribeViewport = viewport$.subscribe((state) => {
    container.setAttribute('data-breakpoint', state.breakpoint);
    container.setAttribute('data-orientation', state.orientation);

    if (state.breakpoint !== previousBreakpoint) {
      onBreakpointChange?.({ state, previous: previousBreakpoint });
      previousBreakpoint = state.breakpoint;
    }
  });

  // Set up resize observer with debounce
  let resizeCleanup: (() => void) | null = null;

  function setupResizeListener(): void {
    if (resizeCleanup) resizeCleanup();
    if (typeof window === 'undefined') return;

    const handleResize = debounce(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const bp = breakpoints
        ? getBreakpoint(width, breakpoints)
        : getBreakpoint(width);
      const orientation = getOrientation(width, height);

      (viewport$ as WritableSignal<ViewportState>).set({
        width,
        height,
        breakpoint: bp,
        orientation,
      });
    }, debounceMs);

    window.addEventListener('resize', handleResize);
    resizeCleanup = () => {
      handleResize.cancel();
      window.removeEventListener('resize', handleResize);
    };

    // Trigger initial measurement
    handleResize();
  }

  setupResizeListener();

  // Build context
  const context: ViewportContext = {
    viewport: viewport$,
    get breakpoint() {
      return viewport$.get().breakpoint;
    },
  };

  // Register context (setContext equivalent)
  viewportContextRegistry.set(container, context);

  // Set initial data attributes
  const initialState = viewport$.get();
  container.setAttribute('data-breakpoint', initialState.breakpoint);
  container.setAttribute('data-orientation', initialState.orientation);

  return {
    element: container,
    viewportSignal: viewport$,

    getCurrentState(): ViewportState {
      return viewport$.get();
    },

    update(newProps: Partial<ViewportProviderProps>): void {
      if (newProps.breakpoints !== undefined) breakpoints = newProps.breakpoints;
      if (newProps.debounceMs !== undefined) {
        debounceMs = newProps.debounceMs;
        setupResizeListener(); // Recreate with new debounce timing
      }
      if (newProps['on:breakpointchange'] !== undefined) {
        onBreakpointChange = newProps['on:breakpointchange'];
      }
      if (newProps.className !== undefined) {
        className = newProps.className;
        container.className = className ?? '';
      }
    },

    destroy(): void {
      unsubscribeViewport();
      if (resizeCleanup) resizeCleanup();
      viewportContextRegistry.delete(container);
      container.remove();
    },
  };
}
