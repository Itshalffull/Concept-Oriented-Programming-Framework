// ============================================================
// Clef Surface NativeScript Widget — DesignTokenProvider
//
// Provides resolved design tokens to descendant NativeScript
// components via an observable context pattern. Converts CSS
// token values to NativeScript-compatible color/dimension values.
// ============================================================

import { Observable, StackLayout, Label, EventData } from '@nativescript/core';

import type {
  DesignTokenValue,
  ResolvedTheme,
  Signal,
  ThemeConfig,
} from '../../shared/types.js';
import { resolveTheme } from '../../shared/surface-bridge.js';

// --------------- Context ---------------

export interface DesignTokenContextValue {
  theme: ResolvedTheme;
  tokens: Record<string, string>;
  getToken(name: string): string | undefined;
}

let _currentContext: DesignTokenContextValue | null = null;

export function getDesignTokens(): DesignTokenContextValue {
  if (!_currentContext) {
    throw new Error('getDesignTokens must be called within a DesignTokenProvider scope.');
  }
  return _currentContext;
}

// --------------- Props ---------------

export interface DesignTokenProviderProps {
  tokens?: DesignTokenValue[];
  themes?: ThemeConfig[];
  resolvedTheme?: ResolvedTheme;
  themeSignal?: Signal<ResolvedTheme>;
  showBorder?: boolean;
  label?: string;
}

// --------------- Component ---------------

export function createDesignTokenProvider(props: DesignTokenProviderProps = {}): StackLayout {
  const {
    tokens = [],
    themes = [],
    resolvedTheme,
    themeSignal,
    showBorder = false,
    label = 'tokens',
  } = props;

  const container = new StackLayout();
  container.className = 'clef-design-token-provider';

  let theme: ResolvedTheme;
  if (themeSignal) {
    theme = themeSignal.get();
  } else if (resolvedTheme) {
    theme = resolvedTheme;
  } else {
    theme = resolveTheme(tokens, themes);
  }

  _currentContext = {
    theme,
    tokens: theme.tokens,
    getToken: (name: string) => theme.tokens[name],
  };

  if (showBorder) {
    container.borderWidth = 1;
    container.borderColor = '#666666';
    container.padding = 8;

    const headerLabel = new Label();
    headerLabel.text = `[${label}: ${theme.name}]`;
    headerLabel.className = 'clef-token-header';
    headerLabel.opacity = 0.6;
    container.addChild(headerLabel);
  }

  if (themeSignal) {
    themeSignal.subscribe((newTheme) => {
      theme = newTheme;
      _currentContext = {
        theme: newTheme,
        tokens: newTheme.tokens,
        getToken: (name: string) => newTheme.tokens[name],
      };
    });
  }

  return container;
}

createDesignTokenProvider.displayName = 'DesignTokenProvider';
export default createDesignTokenProvider;
