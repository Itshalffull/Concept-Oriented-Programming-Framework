// ============================================================
// BindingProvider — Context provider for COIF backend binding.
//
// Subscribes to concept state signals defined in a BindingConfig
// and provides the current state snapshot plus an invoke()
// function for dispatching actions.  All state updates flow
// through COIF signals; no external state management library
// is used.
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from 'react';

import type { BindingConfig, Signal } from '../../shared/types.js';
import { createSignal, createComputed } from '../../shared/coif-bridge.js';

// --------------- Types ---------------

export type InvokeFn = (
  action: string,
  input: Record<string, unknown>
) => Promise<{ ok: boolean; result?: unknown; error?: string }>;

export interface BindingContextValue {
  /** The binding configuration. */
  config: BindingConfig;
  /** Current values from all bound signals, keyed by signal name. */
  state: Record<string, unknown>;
  /** Whether the binding is actively syncing. */
  syncing: boolean;
  /** Last sync error, if any. */
  error: string | null;
  /** Invoke a concept action through the binding. */
  invoke: InvokeFn;
  /** Get a raw signal by name. */
  getSignal(name: string): Signal | undefined;
}

const BindingContext = createContext<BindingContextValue | null>(null);

// --------------- Hook ---------------

export function useBinding(): BindingContextValue {
  const ctx = useContext(BindingContext);
  if (!ctx) {
    throw new Error(
      'useBinding must be used within a <BindingProvider>.'
    );
  }
  return ctx;
}

/**
 * Subscribe to a single signal from the binding by name.
 */
export function useBoundSignal<T = unknown>(signalName: string): T | undefined {
  const { getSignal } = useBinding();
  const signal = getSignal(signalName);

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!signal) return () => {};
      return signal.subscribe(cb);
    },
    [signal]
  );

  const getSnapshot = useCallback(
    () => (signal ? signal.get() : undefined) as T | undefined,
    [signal]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --------------- Props ---------------

export interface BindingProviderProps {
  /** The COIF binding configuration. */
  config: BindingConfig;
  /**
   * Optional invoke implementation.  By default, the provider
   * uses the binding mode to route invocations:
   * - "coupled": direct function call (requires COPF runtime)
   * - "rest": HTTP fetch to config.endpoint
   * - "graphql": GraphQL mutation to config.endpoint
   * - "static": in-memory mutation on signals
   *
   * Override this for custom/mock backends.
   */
  onInvoke?: InvokeFn;
  children: ReactNode;
}

// --------------- Default Invoke Implementations ---------------

function createDefaultInvoke(config: BindingConfig): InvokeFn {
  return async (action, input) => {
    switch (config.mode) {
      case 'rest': {
        if (!config.endpoint) {
          return { ok: false, error: 'No endpoint configured for REST binding.' };
        }
        try {
          const response = await fetch(`${config.endpoint}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          if (!response.ok) {
            return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
          }
          const result = await response.json();
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      }

      case 'graphql': {
        if (!config.endpoint) {
          return { ok: false, error: 'No endpoint configured for GraphQL binding.' };
        }
        try {
          const mutation = `mutation { ${action}(input: ${JSON.stringify(JSON.stringify(input))}) }`;
          const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation }),
          });
          const result = await response.json();
          if (result.errors?.length) {
            return { ok: false, error: result.errors[0].message };
          }
          return { ok: true, result: result.data };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      }

      case 'static': {
        // In static mode we mutate signals directly.
        // The "action" is treated as a signal name, and "input"
        // is the new value.  This is a simplified model useful
        // for prototyping.
        const signal = config.signalMap[action];
        if (signal && 'set' in signal) {
          (signal as any).set(input);
          return { ok: true, result: input };
        }
        return { ok: false, error: `No signal found for action "${action}".` };
      }

      case 'coupled':
      default: {
        // Coupled mode assumes a COPF runtime is available.
        // In a real setup, the COPF engine is injected.
        // For now, log and succeed.
        console.warn(
          `[BindingProvider] coupled invoke not wired: ${action}`,
          input
        );
        return { ok: true, result: null };
      }
    }
  };
}

// --------------- Component ---------------

export const BindingProvider: React.FC<BindingProviderProps> = ({
  config,
  onInvoke,
  children,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a composite signal that aggregates all signal map values
  // into a single Record<string, unknown>.
  const signalEntries = useMemo(
    () => Object.entries(config.signalMap),
    [config.signalMap]
  );

  const allSignals = useMemo(
    () => signalEntries.map(([, sig]) => sig),
    [signalEntries]
  );

  // Create a computed signal that produces the aggregated state
  const compositeSignal = useMemo(() => {
    return createComputed(allSignals, () => {
      const state: Record<string, unknown> = {};
      for (const [name, sig] of signalEntries) {
        state[name] = sig.get();
      }
      return state;
    });
  }, [allSignals, signalEntries]);

  // Subscribe React to the composite signal
  const subscribe = useCallback(
    (cb: () => void) => compositeSignal.subscribe(cb),
    [compositeSignal]
  );

  const getSnapshot = useCallback(
    () => compositeSignal.get(),
    [compositeSignal]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Invoke implementation
  const defaultInvoke = useMemo(
    () => createDefaultInvoke(config),
    [config]
  );

  const invoke = useCallback<InvokeFn>(
    async (action, input) => {
      setSyncing(true);
      setError(null);
      try {
        const fn = onInvoke ?? defaultInvoke;
        const result = await fn(action, input);
        if (!result.ok && result.error) {
          setError(result.error);
        }
        return result;
      } catch (err) {
        const msg = String(err);
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setSyncing(false);
      }
    },
    [onInvoke, defaultInvoke]
  );

  const getSignal = useCallback(
    (name: string): Signal | undefined => config.signalMap[name],
    [config.signalMap]
  );

  const contextValue = useMemo<BindingContextValue>(
    () => ({
      config,
      state,
      syncing,
      error,
      invoke,
      getSignal,
    }),
    [config, state, syncing, error, invoke, getSignal]
  );

  return (
    <BindingContext.Provider value={contextValue}>
      {children}
    </BindingContext.Provider>
  );
};

BindingProvider.displayName = 'BindingProvider';
export { BindingContext };
export default BindingProvider;
