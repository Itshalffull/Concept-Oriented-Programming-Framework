// ============================================================
// SurfaceRoot — Svelte-compatible Clef Surface component
//
// Root surface lifecycle manager. Acts as the top-level mount
// point for a Clef Surface-based UI. Manages surface kind detection
// (browser-dom, ssr, etc.), global lifecycle hooks (mount,
// hydrate, destroy), error boundaries, and coordinates the
// provider tree (tokens, viewport, binding).
// ============================================================

import type {
  SurfaceKind,
  WritableSignal,
  Signal,
} from '../../shared/types.js';

import { createSignal } from '../../shared/surface-bridge.js';

// --- Component types ---

export type SurfaceLifecyclePhase =
  | 'initializing'
  | 'mounting'
  | 'mounted'
  | 'hydrating'
  | 'hydrated'
  | 'updating'
  | 'destroying'
  | 'destroyed'
  | 'error';

export interface SurfaceRootProps {
  kind?: SurfaceKind;
  appId?: string;
  /**
   * Render callback invoked after mount. Receives the content
   * container to populate with child components.
   */
  renderFn?: (contentEl: HTMLElement, api: SurfaceAPI) => void;
  /**
   * Error handler — mirrors Svelte's onError / error boundary.
   */
  onError?: (error: Error, phase: SurfaceLifecyclePhase) => void;
  className?: string;
  'on:mount'?: (event: { surface: SurfaceAPI }) => void;
  'on:destroy'?: (event: { surface: SurfaceAPI }) => void;
  'on:phasechange'?: (event: { phase: SurfaceLifecyclePhase; previous: SurfaceLifecyclePhase }) => void;
}

export interface SurfaceAPI {
  readonly kind: SurfaceKind;
  readonly phase: SurfaceLifecyclePhase;
  readonly appId: string;
  readonly contentElement: HTMLElement;
  readonly rootElement: HTMLElement;
  readonly phaseSignal: Signal<SurfaceLifecyclePhase>;
  /**
   * Register a cleanup function to run on destroy.
   * Mirrors Svelte's onDestroy lifecycle hook.
   */
  onDestroy(fn: () => void): void;
  /**
   * Register a function to run after next update.
   * Mirrors Svelte's afterUpdate / tick.
   */
  afterUpdate(fn: () => void): void;
}

export interface SurfaceRootInstance {
  update(props: Partial<SurfaceRootProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  readonly api: SurfaceAPI;
  getPhase(): SurfaceLifecyclePhase;
}

export interface SurfaceRootOptions {
  target: HTMLElement;
  props: SurfaceRootProps;
}

// --- Surface kind detection ---

function detectSurfaceKind(): SurfaceKind {
  if (typeof window === 'undefined') return 'ssr';
  if (typeof document === 'undefined') return 'ssr';
  if (typeof (globalThis as Record<string, unknown>).process !== 'undefined') {
    const proc = (globalThis as Record<string, unknown>).process as Record<string, unknown>;
    if (proc.versions && typeof (proc.versions as Record<string, unknown>).node === 'string') {
      return 'terminal';
    }
  }
  return 'browser-dom';
}

// --- Component factory ---

export function createSurfaceRoot(
  options: SurfaceRootOptions,
): SurfaceRootInstance {
  const { target } = options;
  let {
    kind,
    appId = 'surface-app',
    renderFn,
    onError,
    className,
  } = options.props;
  let onMount = options.props['on:mount'];
  let onDestroyCallback = options.props['on:destroy'];
  let onPhaseChange = options.props['on:phasechange'];

  // Detect surface kind if not provided
  const surfaceKind: SurfaceKind = kind ?? detectSurfaceKind();

  // Reactive lifecycle phase — mirrors $state rune
  const phase$ = createSignal<SurfaceLifecyclePhase>('initializing');

  // Destroy hooks registry — mirrors Svelte onDestroy
  const destroyHooks: Array<() => void> = [];

  // After-update queue — mirrors Svelte afterUpdate / tick
  let afterUpdateQueue: Array<() => void> = [];

  function setPhase(newPhase: SurfaceLifecyclePhase): void {
    const previous = phase$.get();
    if (previous === newPhase) return;
    (phase$ as WritableSignal<SurfaceLifecyclePhase>).set(newPhase);
    onPhaseChange?.({ phase: newPhase, previous });
  }

  // Create root element structure
  const rootElement = document.createElement('div');
  rootElement.setAttribute('data-surface-surface', '');
  rootElement.setAttribute('data-surface-kind', surfaceKind);
  rootElement.setAttribute('data-app-id', appId);
  rootElement.setAttribute('data-phase', 'initializing');
  rootElement.id = appId;
  if (className) rootElement.className = className;

  // Content container (where child components mount)
  const contentElement = document.createElement('div');
  contentElement.setAttribute('data-surface-surface-content', '');
  rootElement.appendChild(contentElement);

  // Error overlay (hidden by default)
  const errorOverlay = document.createElement('div');
  errorOverlay.setAttribute('data-surface-error-overlay', '');
  errorOverlay.setAttribute('role', 'alert');
  errorOverlay.setAttribute('aria-live', 'assertive');
  errorOverlay.style.cssText = [
    'display: none',
    'position: absolute',
    'inset: 0',
    'background: rgba(220, 38, 38, 0.95)',
    'color: white',
    'padding: 2em',
    'font-family: monospace',
    'white-space: pre-wrap',
    'overflow: auto',
    'z-index: 9999',
  ].join('; ');
  rootElement.appendChild(errorOverlay);

  // Subscribe to phase changes to update DOM
  const unsubPhase = phase$.subscribe((phase) => {
    rootElement.setAttribute('data-phase', phase);
  });

  // Build surface API
  const api: SurfaceAPI = {
    get kind() { return surfaceKind; },
    get phase() { return phase$.get(); },
    get appId() { return appId; },
    contentElement,
    rootElement,
    phaseSignal: phase$,

    onDestroy(fn: () => void): void {
      destroyHooks.push(fn);
    },

    afterUpdate(fn: () => void): void {
      afterUpdateQueue.push(fn);
      // Flush on microtask — mirrors Svelte tick()
      queueMicrotask(() => {
        const queue = afterUpdateQueue;
        afterUpdateQueue = [];
        for (const callback of queue) {
          try {
            callback();
          } catch (err) {
            handleError(err instanceof Error ? err : new Error(String(err)), 'updating');
          }
        }
      });
    },
  };

  // Error handling
  function handleError(error: Error, phase: SurfaceLifecyclePhase): void {
    setPhase('error');
    errorOverlay.textContent = `[Clef Surface Surface Error in "${phase}" phase]\n\n${error.message}\n\n${error.stack ?? ''}`;
    errorOverlay.style.display = 'block';
    contentElement.style.display = 'none';

    if (onError) {
      onError(error, phase);
    } else {
      console.error(`[Clef Surface SurfaceRoot] Error in ${phase} phase:`, error);
    }
  }

  // Mount sequence
  function mount(): void {
    try {
      setPhase('mounting');
      target.appendChild(rootElement);

      // Check if we're hydrating (target has existing content)
      const hasExistingContent = target.querySelector('[data-surface-hydrate]') !== null;

      if (hasExistingContent) {
        setPhase('hydrating');
        // Hydration: preserve existing DOM, attach behavior
        setPhase('hydrated');
      }

      // Invoke render function
      if (renderFn) {
        try {
          renderFn(contentElement, api);
        } catch (err) {
          handleError(err instanceof Error ? err : new Error(String(err)), 'mounting');
          return;
        }
      }

      setPhase('mounted');
      onMount?.({ surface: api });
    } catch (err) {
      handleError(err instanceof Error ? err : new Error(String(err)), 'mounting');
    }
  }

  // Start mount
  mount();

  return {
    element: rootElement,
    api,

    getPhase(): SurfaceLifecyclePhase {
      return phase$.get();
    },

    update(newProps: Partial<SurfaceRootProps>): void {
      try {
        setPhase('updating');

        if (newProps.appId !== undefined) {
          appId = newProps.appId;
          rootElement.setAttribute('data-app-id', appId);
          rootElement.id = appId;
        }
        if (newProps.onError !== undefined) onError = newProps.onError;
        if (newProps['on:mount'] !== undefined) onMount = newProps['on:mount'];
        if (newProps['on:destroy'] !== undefined) onDestroyCallback = newProps['on:destroy'];
        if (newProps['on:phasechange'] !== undefined) onPhaseChange = newProps['on:phasechange'];
        if (newProps.className !== undefined) {
          className = newProps.className;
          rootElement.className = className ?? '';
        }

        // If renderFn changes, re-render content
        if (newProps.renderFn !== undefined) {
          renderFn = newProps.renderFn;
          contentElement.innerHTML = '';
          if (renderFn) {
            renderFn(contentElement, api);
          }
        }

        setPhase('mounted');
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)), 'updating');
      }
    },

    destroy(): void {
      try {
        setPhase('destroying');

        // Invoke all registered destroy hooks (onDestroy equivalent)
        for (const hook of destroyHooks) {
          try {
            hook();
          } catch (err) {
            console.error('[Clef Surface SurfaceRoot] Error in destroy hook:', err);
          }
        }

        onDestroyCallback?.({ surface: api });

        unsubPhase();
        rootElement.remove();

        setPhase('destroyed');
      } catch (err) {
        console.error('[Clef Surface SurfaceRoot] Error during destroy:', err);
      }
    },
  };
}
