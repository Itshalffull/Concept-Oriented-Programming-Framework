// ============================================================
// BindingProvider — Svelte-compatible COIF component
//
// COIF concept binding with reactive store integration. Connects
// a COIF concept's signal map to the component tree, providing
// read/write access to bound data. Supports coupled, REST,
// GraphQL, and static binding modes. Mirrors Svelte's store
// contract ($-prefix auto-subscription pattern).
// ============================================================

import type {
  BindingConfig,
  BindingMode,
  Signal,
  WritableSignal,
} from '../../shared/types.js';

import { createSignal } from '../../shared/coif-bridge.js';

// --- Context registry (module-scoped, mirrors Svelte setContext/getContext) ---

const bindingContextRegistry = new Map<HTMLElement, BindingContext>();

export interface BindingContext {
  readonly concept: string;
  readonly mode: BindingMode;
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  subscribe(key: string, listener: (value: unknown) => void): () => void;
  readonly signals: Record<string, Signal>;
}

export function getBindingContext(node: HTMLElement): BindingContext | undefined {
  let current: HTMLElement | null = node;
  while (current) {
    const ctx = bindingContextRegistry.get(current);
    if (ctx) return ctx;
    current = current.parentElement;
  }
  return undefined;
}

// --- Component types ---

export interface BindingProviderProps {
  config: BindingConfig;
  /** Initial data to populate signals (for static/pre-loaded modes) */
  initialData?: Record<string, unknown>;
  className?: string;
  'on:change'?: (event: { key: string; value: unknown; concept: string }) => void;
  'on:sync'?: (event: { concept: string; data: Record<string, unknown> }) => void;
  'on:error'?: (event: { concept: string; error: Error }) => void;
}

export interface BindingProviderInstance {
  update(props: Partial<BindingProviderProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  getContext(): BindingContext;
  /**
   * Trigger a sync/fetch operation (for REST/GraphQL modes).
   */
  sync(): Promise<void>;
  /**
   * Get all current values as a plain object.
   */
  snapshot(): Record<string, unknown>;
}

export interface BindingProviderOptions {
  target: HTMLElement;
  props: BindingProviderProps;
}

// --- Component factory ---

export function createBindingProvider(
  options: BindingProviderOptions,
): BindingProviderInstance {
  const { target } = options;
  let { config, initialData, className } = options.props;
  let onChange = options.props['on:change'];
  let onSync = options.props['on:sync'];
  let onError = options.props['on:error'];

  // Container element
  const container = document.createElement('div');
  container.setAttribute('data-coif-binding', '');
  container.setAttribute('data-concept', config.concept);
  container.setAttribute('data-binding-mode', config.mode);
  if (className) container.className = className;
  target.appendChild(container);

  // Build reactive signal map — mirrors Svelte writable stores
  // The config.signalMap already contains Signal instances; we track them
  // and optionally create local writables for data not yet in the map.
  const signals: Record<string, Signal> = { ...config.signalMap };
  const subscriptions: Array<() => void> = [];

  // Apply initial data by writing to writable signals
  if (initialData) {
    for (const [key, value] of Object.entries(initialData)) {
      if (signals[key] && 'set' in signals[key]) {
        (signals[key] as WritableSignal).set(value);
      } else if (!signals[key]) {
        // Create a new writable signal for keys not in signalMap
        signals[key] = createSignal(value);
      }
    }
  }

  // Loading / error reactive state
  const loading$ = createSignal<boolean>(false);
  const error$ = createSignal<Error | null>(null);

  // Subscribe to all signals for change events
  function setupSubscriptions(): void {
    // Clean previous
    for (const unsub of subscriptions) unsub();
    subscriptions.length = 0;

    for (const [key, signal] of Object.entries(signals)) {
      const unsub = signal.subscribe((value) => {
        onChange?.({ key, value, concept: config.concept });
      });
      subscriptions.push(unsub);
    }
  }

  setupSubscriptions();

  // Build context object
  const context: BindingContext = {
    get concept() { return config.concept; },
    get mode() { return config.mode; },
    get signals() { return signals; },

    get<T = unknown>(key: string): T | undefined {
      const signal = signals[key];
      return signal ? signal.get() as T : undefined;
    },

    set(key: string, value: unknown): void {
      const signal = signals[key];
      if (signal && 'set' in signal) {
        (signal as WritableSignal).set(value);
      }
    },

    subscribe(key: string, listener: (value: unknown) => void): () => void {
      const signal = signals[key];
      if (!signal) return () => {};
      return signal.subscribe(listener);
    },
  };

  // Register context (setContext equivalent)
  bindingContextRegistry.set(container, context);

  // Sync function for REST/GraphQL modes
  async function sync(): Promise<void> {
    if (config.mode === 'static' || config.mode === 'coupled') {
      // Static and coupled modes don't fetch
      return;
    }

    if (!config.endpoint) {
      onError?.({
        concept: config.concept,
        error: new Error(`No endpoint configured for ${config.mode} binding`),
      });
      return;
    }

    loading$.set(true);
    error$.set(null);
    container.setAttribute('data-loading', '');

    try {
      const response = await fetch(config.endpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Push fetched data into signals
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (signals[key] && 'set' in signals[key]) {
          (signals[key] as WritableSignal).set(value);
        } else {
          signals[key] = createSignal(value);
        }
      }

      loading$.set(false);
      container.removeAttribute('data-loading');
      onSync?.({ concept: config.concept, data: data as Record<string, unknown> });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      loading$.set(false);
      error$.set(error);
      container.removeAttribute('data-loading');
      container.setAttribute('data-error', '');
      onError?.({ concept: config.concept, error });
    }
  }

  // Update container data attributes based on loading/error state
  const unsubLoading = loading$.subscribe((isLoading) => {
    if (isLoading) {
      container.setAttribute('data-loading', '');
    } else {
      container.removeAttribute('data-loading');
    }
  });

  const unsubError = error$.subscribe((err) => {
    if (err) {
      container.setAttribute('data-error', '');
    } else {
      container.removeAttribute('data-error');
    }
  });

  return {
    element: container,

    getContext(): BindingContext {
      return context;
    },

    async sync(): Promise<void> {
      return sync();
    },

    snapshot(): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [key, signal] of Object.entries(signals)) {
        result[key] = signal.get();
      }
      return result;
    },

    update(newProps: Partial<BindingProviderProps>): void {
      if (newProps.config !== undefined) {
        config = newProps.config;
        // Merge new signal map
        Object.assign(signals, config.signalMap);
        container.setAttribute('data-concept', config.concept);
        container.setAttribute('data-binding-mode', config.mode);
        setupSubscriptions();
      }
      if (newProps.initialData !== undefined) {
        initialData = newProps.initialData;
        for (const [key, value] of Object.entries(initialData)) {
          if (signals[key] && 'set' in signals[key]) {
            (signals[key] as WritableSignal).set(value);
          }
        }
      }
      if (newProps['on:change'] !== undefined) onChange = newProps['on:change'];
      if (newProps['on:sync'] !== undefined) onSync = newProps['on:sync'];
      if (newProps['on:error'] !== undefined) onError = newProps['on:error'];
      if (newProps.className !== undefined) {
        className = newProps.className;
        container.className = className ?? '';
      }
    },

    destroy(): void {
      for (const unsub of subscriptions) unsub();
      unsubLoading();
      unsubError();
      bindingContextRegistry.delete(container);
      container.remove();
    },
  };
}
