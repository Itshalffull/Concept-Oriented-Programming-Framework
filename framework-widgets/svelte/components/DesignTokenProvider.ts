// ============================================================
// DesignTokenProvider — Svelte-compatible Clef Surface component
//
// Provides design tokens as CSS custom properties on a container
// element. Implements a context-like pattern (setContext/getContext
// equivalent) so descendant components can look up the active
// token map without prop-drilling.
// ============================================================

import type {
  DesignTokenValue,
  ThemeConfig,
  ResolvedTheme,
  Signal,
  WritableSignal,
} from '../../shared/types.js';

import {
  createSignal,
  resolveTheme,
} from '../../shared/surface-bridge.js';

// --- Context registry (module-scoped, mirrors Svelte setContext/getContext) ---

const contextRegistry = new Map<HTMLElement, DesignTokenContext>();

export interface DesignTokenContext {
  readonly theme: Signal<ResolvedTheme>;
  getToken(name: string): string | undefined;
}

export function getTokenContext(node: HTMLElement): DesignTokenContext | undefined {
  let current: HTMLElement | null = node;
  while (current) {
    const ctx = contextRegistry.get(current);
    if (ctx) return ctx;
    current = current.parentElement;
  }
  return undefined;
}

// --- Component types ---

export interface DesignTokenProviderProps {
  tokens: DesignTokenValue[];
  themes?: ThemeConfig[];
  className?: string;
}

export interface DesignTokenProviderInstance {
  update(props: Partial<DesignTokenProviderProps>): void;
  destroy(): void;
  getContext(): DesignTokenContext;
  readonly element: HTMLElement;
}

export interface DesignTokenProviderOptions {
  target: HTMLElement;
  props: DesignTokenProviderProps;
}

// --- Component factory ---

export function createDesignTokenProvider(
  options: DesignTokenProviderOptions,
): DesignTokenProviderInstance {
  const { target } = options;
  let { tokens, themes = [], className } = options.props;

  // Create the wrapper container
  const container = document.createElement('div');
  container.setAttribute('data-surface-token-provider', '');
  if (className) container.className = className;
  target.appendChild(container);

  // Reactive signal for the resolved theme — mirrors Svelte $state
  const resolvedTheme = createSignal<ResolvedTheme>(
    resolveTheme(tokens, themes),
  );

  // Apply CSS variables to the container
  function applyTokens(theme: ResolvedTheme): void {
    for (const [name, value] of Object.entries(theme.tokens)) {
      const cssName = name
        .replace(/\./g, '-')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase();
      container.style.setProperty(`--${cssName}`, value);
    }
    container.setAttribute('data-theme', theme.name);
  }

  // Initial apply
  applyTokens(resolvedTheme.get());

  // Subscribe to theme changes — mirrors Svelte $derived auto-tracking
  const unsubscribe = resolvedTheme.subscribe((theme) => {
    applyTokens(theme);
  });

  // Build the context object
  const context: DesignTokenContext = {
    theme: resolvedTheme,
    getToken(name: string): string | undefined {
      return resolvedTheme.get().tokens[name];
    },
  };

  // Register context on this container (setContext equivalent)
  contextRegistry.set(container, context);

  return {
    element: container,

    getContext(): DesignTokenContext {
      return context;
    },

    update(newProps: Partial<DesignTokenProviderProps>): void {
      if (newProps.tokens !== undefined) tokens = newProps.tokens;
      if (newProps.themes !== undefined) themes = newProps.themes ?? [];
      if (newProps.className !== undefined) {
        className = newProps.className;
        container.className = className ?? '';
      }

      // Re-resolve and push through the signal
      (resolvedTheme as WritableSignal<ResolvedTheme>).set(
        resolveTheme(tokens, themes),
      );
    },

    destroy(): void {
      unsubscribe();
      contextRegistry.delete(container);
      container.remove();
    },
  };
}
