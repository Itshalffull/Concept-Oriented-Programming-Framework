// ============================================================
// BindingProvider — Solid.js Component
//
// Clef Surface concept binding with Solid stores. Creates a reactive
// data store that synchronizes with concept signals and
// provides fine-grained reactivity for descendant components.
// Supports coupled, REST, GraphQL, and static binding modes.
// ============================================================

import type {
  BindingConfig,
  BindingMode,
  Signal,
} from '../../shared/types.js';

import { createSignal as surfaceCreateSignal } from '../../shared/surface-bridge.js';

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

// --- Solid store (reactive object proxy) ---

interface SolidStore<T extends Record<string, unknown>> {
  get: () => T;
  set: (key: keyof T, value: T[keyof T]) => void;
  update: (partial: Partial<T>) => void;
  subscribe: (listener: (store: T) => void) => () => void;
}

function createStore<T extends Record<string, unknown>>(initial: T): SolidStore<T> {
  const [state, setState] = solidCreateSignal<T>({ ...initial });
  const listeners = new Set<(store: T) => void>();

  function notify() {
    const current = state();
    for (const fn of listeners) fn(current);
  }

  return {
    get: state,
    set(key: keyof T, value: T[keyof T]) {
      const current = state();
      setState({ ...current, [key]: value } as T);
      notify();
    },
    update(partial: Partial<T>) {
      const current = state();
      setState({ ...current, ...partial } as T);
      notify();
    },
    subscribe(listener: (store: T) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// --- Binding context registry ---

export interface BindingContext {
  concept: string;
  mode: BindingMode;
  store: SolidStore<Record<string, unknown>>;
  refresh: () => Promise<void>;
  submit: (data?: Record<string, unknown>) => Promise<void>;
}

const bindingContextRegistry = new WeakMap<HTMLElement, BindingContext>();

export function getBindingContext(el: HTMLElement): BindingContext | undefined {
  let current: HTMLElement | null = el;
  while (current) {
    const ctx = bindingContextRegistry.get(current);
    if (ctx) return ctx;
    current = current.parentElement;
  }
  return undefined;
}

// --- Component Props ---

export interface BindingProviderProps {
  config: BindingConfig;
  initialData?: Record<string, unknown>;
  onFetch?: (endpoint: string) => Promise<Record<string, unknown>>;
  onSubmit?: (endpoint: string, data: Record<string, unknown>) => Promise<void>;
  class?: string;
  children?: HTMLElement[];
}

// --- Component Result ---

export interface BindingProviderResult {
  element: HTMLElement;
  context: BindingContext;
  dispose: () => void;
}

// --- Component ---

export function BindingProvider(props: BindingProviderProps): BindingProviderResult {
  const config = props.config;

  // Build initial store data from signal map
  const initialData: Record<string, unknown> = { ...props.initialData };
  for (const [key, signal] of Object.entries(config.signalMap)) {
    initialData[key] = signal.get();
  }

  const store = createStore<Record<string, unknown>>(initialData);
  const [loading, setLoading] = solidCreateSignal<boolean>(false);
  const [error, setError] = solidCreateSignal<string | null>(null);

  // Subscribe to signal map changes and sync into store
  const signalUnsubs: Array<() => void> = [];
  for (const [key, signal] of Object.entries(config.signalMap)) {
    const unsub = signal.subscribe((value: unknown) => {
      store.set(key, value);
    });
    signalUnsubs.push(unsub);
  }

  // Refresh: fetch data from endpoint (for REST/GraphQL modes)
  async function refresh(): Promise<void> {
    if (config.mode === 'static' || config.mode === 'coupled') {
      return;
    }

    if (!config.endpoint) return;

    setLoading(true);
    setError(null);

    try {
      let data: Record<string, unknown>;

      if (props.onFetch) {
        data = await props.onFetch(config.endpoint);
      } else if (typeof fetch !== 'undefined') {
        const response = await fetch(config.endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        data = await response.json();
      } else {
        throw new Error('No fetch implementation available');
      }

      store.update(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Submit: push data to endpoint
  async function submit(data?: Record<string, unknown>): Promise<void> {
    if (config.mode === 'static') return;
    if (!config.endpoint) return;

    const payload = data ?? store.get();
    setLoading(true);
    setError(null);

    try {
      if (props.onSubmit) {
        await props.onSubmit(config.endpoint, payload);
      } else if (typeof fetch !== 'undefined') {
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Build context
  const context: BindingContext = {
    concept: config.concept,
    mode: config.mode,
    store,
    refresh,
    submit,
  };

  // Create provider container
  const container = document.createElement('div');
  container.setAttribute('data-surface-provider', 'binding');
  container.setAttribute('data-concept', config.concept);
  container.setAttribute('data-binding-mode', config.mode);
  container.style.setProperty('display', 'contents');

  // Register context
  bindingContextRegistry.set(container, context);

  if (props.class) {
    container.setAttribute('class', props.class);
  }

  // Reactive effect: update data attributes for loading/error state
  const disposeLoadingEffect = solidCreateEffect([loading, error], () => {
    if (loading()) {
      container.setAttribute('data-loading', 'true');
    } else {
      container.removeAttribute('data-loading');
    }

    const err = error();
    if (err) {
      container.setAttribute('data-error', err);
    } else {
      container.removeAttribute('data-error');
    }
  });

  // Reactive effect: dispatch store change events
  const unsubStore = store.subscribe((data) => {
    container.dispatchEvent(
      new CustomEvent('surface:binding-change', {
        bubbles: true,
        detail: {
          concept: config.concept,
          mode: config.mode,
          data,
        },
      })
    );
  });

  // Auto-fetch on mount for REST/GraphQL modes
  if (config.mode === 'rest' || config.mode === 'graphql') {
    refresh().catch(() => { /* error captured in signal */ });
  }

  // Append children
  if (props.children) {
    for (const child of props.children) {
      container.appendChild(child);
    }
  }

  function dispose() {
    disposeLoadingEffect();
    unsubStore();
    for (const unsub of signalUnsubs) unsub();
    bindingContextRegistry.delete(container);
    container.remove();
  }

  return { element: container, context, dispose };
}
