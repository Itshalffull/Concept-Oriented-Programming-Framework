'use client';

// ============================================================
// BindingProvider — Next.js context provider for Clef Surface
// backend binding. Functional component only.
//
// Subscribes to concept state signals and provides current state
// snapshot plus an invoke() function for dispatching actions.
// Supports Server Actions for mutations via 'use server' integration.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from 'react';

import type { BindingConfig, Signal } from '../../shared/types.js';
import { createSignal, createComputed } from '../../shared/surface-bridge.js';

export type InvokeFn = (
  action: string,
  input: Record<string, unknown>
) => Promise<{ ok: boolean; result?: unknown; error?: string }>;

export interface BindingContextValue {
  readonly config: BindingConfig;
  readonly state: Record<string, unknown>;
  readonly syncing: boolean;
  readonly error: string | null;
  readonly invoke: InvokeFn;
  readonly getSignal: (name: string) => Signal | undefined;
}

const BindingContext = createContext<BindingContextValue | null>(null);

export const useBinding = (): BindingContextValue => {
  const ctx = useContext(BindingContext);
  if (!ctx) {
    throw new Error(
      'useBinding must be used within a <BindingProvider>.'
    );
  }
  return ctx;
};

export const useBoundSignal = <T = unknown>(signalName: string): T | undefined => {
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
};

export interface BindingProviderProps {
  readonly config: BindingConfig;
  readonly onInvoke?: InvokeFn;
  readonly serverAction?: (action: string, input: Record<string, unknown>) => Promise<unknown>;
  readonly children: ReactNode;
}

const createDefaultInvoke = (
  config: BindingConfig,
  serverAction?: (action: string, input: Record<string, unknown>) => Promise<unknown>,
): InvokeFn => {
  return async (action, input) => {
    // Prefer Server Action when available (Next.js optimization)
    if (serverAction) {
      try {
        const result = await serverAction(action, input);
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }

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
        const signal = config.signalMap[action];
        if (signal && 'set' in signal) {
          (signal as any).set(input);
          return { ok: true, result: input };
        }
        return { ok: false, error: `No signal found for action "${action}".` };
      }

      case 'coupled':
      default: {
        console.warn(
          `[BindingProvider] coupled invoke not wired: ${action}`,
          input
        );
        return { ok: true, result: null };
      }
    }
  };
};

export const BindingProvider = ({
  config,
  onInvoke,
  serverAction,
  children,
}: BindingProviderProps): ReactNode => {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signalEntries = useMemo(
    () => Object.entries(config.signalMap),
    [config.signalMap]
  );

  const allSignals = useMemo(
    () => signalEntries.map(([, sig]) => sig),
    [signalEntries]
  );

  const compositeSignal = useMemo(() => {
    return createComputed(allSignals, () => {
      const state: Record<string, unknown> = {};
      for (const [name, sig] of signalEntries) {
        state[name] = sig.get();
      }
      return state;
    });
  }, [allSignals, signalEntries]);

  const subscribe = useCallback(
    (cb: () => void) => compositeSignal.subscribe(cb),
    [compositeSignal]
  );

  const getSnapshot = useCallback(
    () => compositeSignal.get(),
    [compositeSignal]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const defaultInvoke = useMemo(
    () => createDefaultInvoke(config, serverAction),
    [config, serverAction]
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
    () => ({ config, state, syncing, error, invoke, getSignal }),
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
