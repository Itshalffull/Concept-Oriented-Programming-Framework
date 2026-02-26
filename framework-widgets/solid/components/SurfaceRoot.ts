// ============================================================
// SurfaceRoot — Solid.js Component
//
// Root surface lifecycle manager. Manages the top-level
// rendering surface for a Clef Surface application, including
// mount/unmount lifecycle, surface kind detection, and
// coordination of provider contexts (tokens, viewport, binding).
// ============================================================

import type {
  SurfaceKind,
  DesignTokenValue,
  ThemeConfig,
  BindingConfig,
} from '../../shared/types.js';

import { createSignal as surfaceCreateSignal } from '../../shared/surface-bridge.js';

import {
  DesignTokenProvider,
  type DesignTokenProviderResult,
} from './DesignTokenProvider.js';

import {
  ViewportProvider,
  type ViewportProviderResult,
} from './ViewportProvider.js';

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

// --- Surface kind detection ---

function detectSurfaceKind(): SurfaceKind {
  if (typeof window === 'undefined') {
    return 'ssr';
  }
  if (typeof document === 'undefined') {
    return 'terminal';
  }
  // Check for webview indicators
  const ua = navigator.userAgent || '';
  if (ua.includes('wv') || ua.includes('WebView')) {
    return 'webview';
  }
  return 'browser-dom';
}

// --- Lifecycle phase ---

export type LifecyclePhase =
  | 'created'
  | 'mounting'
  | 'mounted'
  | 'updating'
  | 'unmounting'
  | 'disposed';

// --- Component Props ---

export interface SurfaceRootProps {
  id?: string;
  surfaceKind?: SurfaceKind;
  tokens?: DesignTokenValue[];
  themes?: ThemeConfig[];
  enableViewport?: boolean;
  class?: string;
  children?: HTMLElement[];
  onMount?: (surface: SurfaceRootResult) => void;
  onUnmount?: () => void;
  onError?: (error: Error) => void;
}

// --- Component Result ---

export interface SurfaceRootResult {
  element: HTMLElement;
  dispose: () => void;
  surfaceKind: () => SurfaceKind;
  phase: () => LifecyclePhase;
  mountTo: (target: HTMLElement) => void;
  unmount: () => void;
  tokenProvider: DesignTokenProviderResult | null;
  viewportProvider: ViewportProviderResult | null;
}

// --- Component ---

export function SurfaceRoot(props: SurfaceRootProps): SurfaceRootResult {
  const surfaceKind = props.surfaceKind ?? detectSurfaceKind();
  const [phase, setPhase] = solidCreateSignal<LifecyclePhase>('created');
  const [mounted, setMounted] = solidCreateSignal<boolean>(false);

  // Create the root element
  const root = document.createElement('div');
  root.setAttribute('data-surface-surface', 'root');
  root.setAttribute('data-surface-kind', surfaceKind);
  root.setAttribute('data-surface-phase', 'created');

  if (props.id) {
    root.setAttribute('id', props.id);
  }
  if (props.class) {
    root.setAttribute('class', props.class);
  }

  // Build inner content tree with optional providers
  let tokenProvider: DesignTokenProviderResult | null = null;
  let viewportProvider: ViewportProviderResult | null = null;
  let contentRoot: HTMLElement = root;

  // Wrap with DesignTokenProvider if tokens are provided
  if (props.tokens && props.tokens.length > 0) {
    tokenProvider = DesignTokenProvider({
      tokens: props.tokens,
      themes: props.themes,
      scope: props.id ?? 'surface-root',
    });
    root.appendChild(tokenProvider.element);
    contentRoot = tokenProvider.element;
  }

  // Wrap with ViewportProvider if enabled
  if (props.enableViewport !== false) {
    viewportProvider = ViewportProvider({});
    contentRoot.appendChild(viewportProvider.element);
    contentRoot = viewportProvider.element;
  }

  // Append user children to the innermost content root
  if (props.children) {
    for (const child of props.children) {
      contentRoot.appendChild(child);
    }
  }

  // Reactive effect: update data-surface-phase attribute
  const disposePhaseEffect = solidCreateEffect([phase], () => {
    root.setAttribute('data-surface-phase', phase());

    root.dispatchEvent(
      new CustomEvent('surface:surface-lifecycle', {
        bubbles: true,
        detail: {
          phase: phase(),
          surfaceKind,
          id: props.id,
        },
      })
    );
  });

  // Error boundary: wrap operations in try/catch
  function safeExecute(fn: () => void) {
    try {
      fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (props.onError) {
        props.onError(error);
      }
      root.setAttribute('data-surface-error', error.message);
    }
  }

  // Mount the surface to a target DOM element
  function mountTo(target: HTMLElement) {
    safeExecute(() => {
      setPhase('mounting');

      target.appendChild(root);

      setPhase('mounted');
      setMounted(true);

      if (props.onMount) {
        props.onMount(result);
      }
    });
  }

  // Unmount the surface
  function unmount() {
    safeExecute(() => {
      if (!mounted()) return;

      setPhase('unmounting');

      if (props.onUnmount) {
        props.onUnmount();
      }

      root.remove();
      setMounted(false);
      setPhase('disposed');
    });
  }

  // Cleanup
  function dispose() {
    unmount();
    disposePhaseEffect();

    if (tokenProvider) {
      tokenProvider.dispose();
    }
    if (viewportProvider) {
      viewportProvider.dispose();
    }

    setPhase('disposed');
  }

  // Handle visibility change for lifecycle awareness
  if (typeof document !== 'undefined') {
    const visibilityHandler = () => {
      if (document.hidden && mounted()) {
        root.setAttribute('data-surface-visible', 'false');
      } else if (mounted()) {
        root.setAttribute('data-surface-visible', 'true');
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  // Handle beforeunload for cleanup
  if (typeof window !== 'undefined') {
    const unloadHandler = () => {
      if (mounted()) {
        dispose();
      }
    };
    window.addEventListener('beforeunload', unloadHandler);
  }

  const result: SurfaceRootResult = {
    element: root,
    dispose,
    surfaceKind: () => surfaceKind,
    phase,
    mountTo,
    unmount,
    tokenProvider,
    viewportProvider,
  };

  return result;
}
