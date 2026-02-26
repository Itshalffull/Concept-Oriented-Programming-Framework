'use client';

// ============================================================
// ViewportProvider — Next.js client context provider that
// observes window resize events and provides ViewportState to
// the tree.
//
// Creates and manages a Clef Surface WritableSignal<ViewportState>
// internally, and exposes the current state via React context.
// Uses useSyncExternalStore for tear-free reads. The viewport
// signal is also exposed so sibling Clef Surface systems (e.g.
// LayoutContainer) can subscribe directly.
//
// Provides proper SSR snapshot for Next.js server rendering.
// Functional component only — no classes.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

import type { ViewportState, Breakpoint, WritableSignal } from '../../shared/types.js';
import {
  createViewportSignal,
  observeViewport,
  getBreakpoint,
  getOrientation,
} from '../../shared/surface-bridge.js';

// --------------- Context ---------------

export interface ViewportContextValue {
  /** Current viewport state snapshot. */
  readonly viewport: ViewportState;
  /** The underlying Clef Surface signal — can be shared with other bridge consumers. */
  readonly signal: WritableSignal<ViewportState>;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

// --------------- Hook ---------------

export const useViewport = (): ViewportContextValue => {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error(
      'useViewport must be used within a <ViewportProvider>.'
    );
  }
  return ctx;
};

/**
 * Convenience hook: returns just the current breakpoint string.
 */
export const useBreakpoint = (): Breakpoint => useViewport().viewport.breakpoint;

// --------------- Props ---------------

export interface ViewportProviderProps {
  /**
   * Optional externally-created signal. When provided the
   * provider will subscribe to it instead of creating its own.
   */
  readonly signal?: WritableSignal<ViewportState>;
  /**
   * Initial width when running outside a browser (SSR).
   * @default 1024
   */
  readonly initialWidth?: number;
  /**
   * Initial height for SSR.
   * @default 768
   */
  readonly initialHeight?: number;
  readonly children: ReactNode;
}

// --------------- Component ---------------

export const ViewportProvider = ({
  signal: externalSignal,
  initialWidth = 1024,
  initialHeight = 768,
  children,
}: ViewportProviderProps): ReactNode => {
  // Create an internal signal only if none was provided.
  // Use a ref so the signal identity is stable across renders.
  const internalSignalRef = useRef<WritableSignal<ViewportState> | null>(null);
  if (!externalSignal && !internalSignalRef.current) {
    internalSignalRef.current = createViewportSignal(initialWidth, initialHeight);
  }

  const signal = externalSignal ?? internalSignalRef.current!;

  // Observe window resize -> update the signal.
  useEffect(() => {
    const unsubscribe = observeViewport(signal);
    return unsubscribe;
  }, [signal]);

  // Subscribe React to signal changes.
  const subscribe = useCallback(
    (cb: () => void) => signal.subscribe(cb),
    [signal]
  );

  const getSnapshot = useCallback(() => signal.get(), [signal]);

  // SSR snapshot: return the initial state for Next.js server rendering.
  const getServerSnapshot = useCallback(
    () => ({
      width: initialWidth,
      height: initialHeight,
      breakpoint: getBreakpoint(initialWidth),
      orientation: getOrientation(initialWidth, initialHeight),
    }),
    [initialWidth, initialHeight]
  );

  const viewport = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const contextValue = useMemo<ViewportContextValue>(
    () => ({ viewport, signal }),
    [viewport, signal]
  );

  return (
    <ViewportContext.Provider value={contextValue}>
      {children}
    </ViewportContext.Provider>
  );
};

ViewportProvider.displayName = 'ViewportProvider';
export { ViewportContext };
export default ViewportProvider;
