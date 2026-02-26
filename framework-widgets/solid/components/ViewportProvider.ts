// ============================================================
// ViewportProvider — Solid.js Component
//
// Reactive viewport observer with createSignal. Tracks window
// dimensions, breakpoint, and orientation. Exposes a signal-
// based context that child components can read for responsive
// behavior without additional event listeners.
// ============================================================

import type {
  ViewportState,
  Breakpoint,
} from '../../shared/types.js';

import {
  createViewportSignal,
  observeViewport,
  getBreakpoint,
  getOrientation,
  createSignal as surfaceCreateSignal,
} from '../../shared/surface-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());

  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);

  return () => {
    clearInterval(interval);
    if (typeof cleanup === 'function') cleanup();
  };
}

// --- Viewport context registry ---

export interface ViewportContext {
  state: () => ViewportState;
  breakpoint: () => Breakpoint;
  isMobile: () => boolean;
  isTablet: () => boolean;
  isDesktop: () => boolean;
  isPortrait: () => boolean;
}

const viewportContextRegistry = new WeakMap<HTMLElement, ViewportContext>();

export function getViewportContext(el: HTMLElement): ViewportContext | undefined {
  let current: HTMLElement | null = el;
  while (current) {
    const ctx = viewportContextRegistry.get(current);
    if (ctx) return ctx;
    current = current.parentElement;
  }
  return undefined;
}

// --- Component Props ---

export interface ViewportProviderProps {
  initialWidth?: number;
  initialHeight?: number;
  customBreakpoints?: Record<string, number>;
  debounceMs?: number;
  children?: HTMLElement[];
}

// --- Component Result ---

export interface ViewportProviderResult {
  element: HTMLElement;
  context: ViewportContext;
  dispose: () => void;
}

// --- Component ---

export function ViewportProvider(props: ViewportProviderProps): ViewportProviderResult {
  const initialWidth = props.initialWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const initialHeight = props.initialHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 768);

  const [viewport, setViewport] = solidCreateSignal<ViewportState>({
    width: initialWidth,
    height: initialHeight,
    breakpoint: getBreakpoint(initialWidth, props.customBreakpoints),
    orientation: getOrientation(initialWidth, initialHeight),
  });

  // Set up window resize observation
  let disposeObserver: (() => void) | null = null;

  if (typeof window !== 'undefined') {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debounceMs = props.debounceMs ?? 100;

    const handler = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        setViewport({
          width,
          height,
          breakpoint: getBreakpoint(width, props.customBreakpoints),
          orientation: getOrientation(width, height),
        });
      }, debounceMs);
    };

    window.addEventListener('resize', handler, { passive: true });
    disposeObserver = () => {
      window.removeEventListener('resize', handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }

  // Derived reactive getters
  const breakpoint = (): Breakpoint => viewport().breakpoint;
  const isMobile = (): boolean => {
    const bp = breakpoint();
    return bp === 'xs' || bp === 'sm';
  };
  const isTablet = (): boolean => breakpoint() === 'md';
  const isDesktop = (): boolean => {
    const bp = breakpoint();
    return bp === 'lg' || bp === 'xl';
  };
  const isPortrait = (): boolean => viewport().orientation === 'portrait';

  // Build context
  const context: ViewportContext = {
    state: viewport,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
  };

  // Create provider container
  const container = document.createElement('div');
  container.setAttribute('data-surface-provider', 'viewport');
  container.style.setProperty('display', 'contents');

  // Register context
  viewportContextRegistry.set(container, context);

  // Reactive effect: update data attributes when viewport changes
  const disposeEffect = solidCreateEffect([viewport as () => unknown], () => {
    const vp = viewport();
    container.setAttribute('data-breakpoint', vp.breakpoint);
    container.setAttribute('data-orientation', vp.orientation);
    container.setAttribute('data-width', String(vp.width));
    container.setAttribute('data-height', String(vp.height));

    // Dispatch event for consumers
    container.dispatchEvent(
      new CustomEvent('surface:viewport-change', {
        bubbles: true,
        detail: vp,
      })
    );
  });

  // Append children
  if (props.children) {
    for (const child of props.children) {
      container.appendChild(child);
    }
  }

  function dispose() {
    disposeEffect();
    if (disposeObserver) disposeObserver();
    viewportContextRegistry.delete(container);
    container.remove();
  }

  return { element: container, context, dispose };
}
