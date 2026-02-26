// ============================================================
// ViewportProvider — Context provider that observes window
// resize events and provides ViewportState to the tree.
//
// Creates and manages a Clef Surface WritableSignal<ViewportState>
// internally, and exposes the current state via React context.
// Uses useSyncExternalStore for tear-free reads. The viewport
// signal is also exposed so sibling Clef Surface systems (e.g.
// LayoutContainer) can subscribe directly.
// ============================================================

import React, {
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
  viewport: ViewportState;
  /** The underlying Clef Surface signal — can be shared with other bridge consumers. */
  signal: WritableSignal<ViewportState>;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

// --------------- Hook ---------------

export function useViewport(): ViewportContextValue {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error(
      'useViewport must be used within a <ViewportProvider>.'
    );
  }
  return ctx;
}

/**
 * Convenience hook: returns just the current breakpoint string.
 */
export function useBreakpoint(): Breakpoint {
  return useViewport().viewport.breakpoint;
}

// --------------- Props ---------------

export interface ViewportProviderProps {
  /**
   * Optional externally-created signal.  When provided the
   * provider will subscribe to it instead of creating its own.
   */
  signal?: WritableSignal<ViewportState>;
  /**
   * Initial width when running outside a browser (SSR).
   * @default 1024
   */
  initialWidth?: number;
  /**
   * Initial height for SSR.
   * @default 768
   */
  initialHeight?: number;
  children: ReactNode;
}

// --------------- Component ---------------

export const ViewportProvider: React.FC<ViewportProviderProps> = ({
  signal: externalSignal,
  initialWidth = 1024,
  initialHeight = 768,
  children,
}) => {
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

  // SSR snapshot: return the initial state.
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
