// ============================================================
// Clef Surface Ink Widget — DesignTokenProvider
//
// Context provider that supplies resolved design tokens to
// descendant Ink components. Converts CSS hex colors to Ink's
// color system and provides token lookup via React context.
// ============================================================

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { Box, Text } from 'ink';

import type {
  DesignTokenValue,
  ResolvedTheme,
  Signal,
  ThemeConfig,
} from '../../shared/types.js';
import { resolveTheme } from '../../shared/surface-bridge.js';

// --------------- Context ---------------

export interface DesignTokenContextValue {
  /** The currently resolved theme object. */
  theme: ResolvedTheme;
  /** Lookup a single token value by name. */
  getToken(name: string): string | undefined;
  /** The raw token map (token-name -> value). */
  tokens: Record<string, string>;
}

const DesignTokenContext = createContext<DesignTokenContextValue | null>(null);

// --------------- Hook ---------------

export function useDesignTokens(): DesignTokenContextValue {
  const ctx = useContext(DesignTokenContext);
  if (!ctx) {
    throw new Error(
      'useDesignTokens must be used within a <DesignTokenProvider>.',
    );
  }
  return ctx;
}

// --------------- Props ---------------

export interface DesignTokenProviderProps {
  /** Raw design tokens to provide. */
  tokens?: DesignTokenValue[];
  /** Theme configurations to resolve against tokens. */
  themes?: ThemeConfig[];
  /** Pre-resolved theme (alternative to tokens + themes). */
  resolvedTheme?: ResolvedTheme;
  /** A signal that emits resolved theme snapshots. */
  themeSignal?: Signal<ResolvedTheme>;
  /** Whether to render a visual border around the provider scope. */
  showBorder?: boolean;
  /** Label to display in the border header. */
  label?: string;
  children: ReactNode;
}

// --------------- Component ---------------

export const DesignTokenProvider: React.FC<DesignTokenProviderProps> = ({
  tokens = [],
  themes = [],
  resolvedTheme,
  themeSignal,
  showBorder = false,
  label = 'tokens',
  children,
}) => {
  const [signalTheme, setSignalTheme] = useState<ResolvedTheme | null>(
    themeSignal ? themeSignal.get() : null,
  );

  useEffect(() => {
    if (!themeSignal) return;
    setSignalTheme(themeSignal.get());
    return themeSignal.subscribe((value) => setSignalTheme(value));
  }, [themeSignal]);

  const theme = useMemo(() => {
    if (signalTheme) return signalTheme;
    if (resolvedTheme) return resolvedTheme;
    return resolveTheme(tokens, themes);
  }, [signalTheme, resolvedTheme, tokens, themes]);

  const contextValue = useMemo<DesignTokenContextValue>(
    () => ({
      theme,
      tokens: theme.tokens,
      getToken: (name: string) => theme.tokens[name],
    }),
    [theme],
  );

  return (
    <DesignTokenContext.Provider value={contextValue}>
      {showBorder ? (
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text dimColor>
            [{label}: {theme.name}]
          </Text>
          {children}
        </Box>
      ) : (
        <Box flexDirection="column">{children}</Box>
      )}
    </DesignTokenContext.Provider>
  );
};

DesignTokenProvider.displayName = 'DesignTokenProvider';
export { DesignTokenContext };
export default DesignTokenProvider;
