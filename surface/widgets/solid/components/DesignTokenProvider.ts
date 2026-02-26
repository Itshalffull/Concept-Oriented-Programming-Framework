// ============================================================
// DesignTokenProvider — Solid.js Component
//
// Creates a context with resolved design tokens. Uses
// createSignal/createEffect patterns for reactive CSS variable
// injection into a scoped container element.
// ============================================================

import type {
  DesignTokenValue,
  ThemeConfig,
  ResolvedTheme,
} from '../../shared/types.js';

import {
  resolveTheme,
  createSignal as surfaceCreateSignal,
} from '../../shared/surface-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  const unsubs: Array<() => void> = [];

  // Run the effect once initially
  cleanup = fn();

  // Subscribe to each dep's underlying signal for changes
  // We track by polling — in real Solid this is automatic via proxy tracking
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
    unsubs.forEach(u => u());
  };
}

// --- Token context (shared across provider consumers) ---

export interface TokenContext {
  resolved: () => ResolvedTheme;
  getToken: (name: string) => string | undefined;
  updateTokens: (tokens: DesignTokenValue[]) => void;
  updateThemes: (themes: ThemeConfig[]) => void;
}

// Global context registry keyed by provider element
const contextRegistry = new WeakMap<HTMLElement, TokenContext>();

export function getTokenContext(el: HTMLElement): TokenContext | undefined {
  let current: HTMLElement | null = el;
  while (current) {
    const ctx = contextRegistry.get(current);
    if (ctx) return ctx;
    current = current.parentElement;
  }
  return undefined;
}

// --- Component Props ---

export interface DesignTokenProviderProps {
  tokens: DesignTokenValue[];
  themes?: ThemeConfig[];
  scope?: string;
  children?: HTMLElement[];
}

// --- Component Result ---

export interface DesignTokenProviderResult {
  element: HTMLElement;
  context: TokenContext;
  dispose: () => void;
}

// --- Component ---

export function DesignTokenProvider(props: DesignTokenProviderProps): DesignTokenProviderResult {
  const [tokens, setTokens] = solidCreateSignal<DesignTokenValue[]>(props.tokens);
  const [themes, setThemes] = solidCreateSignal<ThemeConfig[]>(props.themes ?? []);

  // Derived resolved theme — equivalent to createMemo
  const resolved = (): ResolvedTheme => resolveTheme(tokens(), themes());

  // Create the provider container element
  const container = document.createElement('div');
  container.setAttribute('data-surface-provider', 'design-tokens');
  if (props.scope) {
    container.setAttribute('data-scope', props.scope);
  }
  container.style.display = 'contents';

  // Build the token context
  const context: TokenContext = {
    resolved,
    getToken(name: string): string | undefined {
      return resolved().tokens[name];
    },
    updateTokens(newTokens: DesignTokenValue[]) {
      setTokens(newTokens);
    },
    updateThemes(newThemes: ThemeConfig[]) {
      setThemes(newThemes);
    },
  };

  // Register context on the element
  contextRegistry.set(container, context);

  // Reactive effect: inject CSS custom properties whenever tokens/themes change
  const disposeEffect = solidCreateEffect([tokens, themes], () => {
    const theme = resolved();
    const entries = Object.entries(theme.tokens);

    for (const [name, value] of entries) {
      const cssName = `--${name.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      container.style.setProperty(cssName, value);
    }

    // Dispatch a custom event for downstream consumers
    container.dispatchEvent(
      new CustomEvent('surface:tokens-changed', {
        bubbles: true,
        detail: { theme: theme.name, tokenCount: entries.length },
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
    contextRegistry.delete(container);
    container.remove();
  }

  return { element: container, context, dispose };
}
