// ============================================================
// DesignTokenProvider — Context provider that supplies resolved
// design tokens as CSS custom properties. Subscribes to a
// Signal<ResolvedTheme> via useSyncExternalStore so that every
// token change triggers a synchronous React re-render with the
// new CSS variable set injected on a wrapper <div>.
// ============================================================

import React, {
  createContext,
  useContext,
  useSyncExternalStore,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';

import type { Signal, ResolvedTheme } from '../../shared/types.js';
import { createSignal, resolveTheme, themeToCssVariables } from '../../shared/coif-bridge.js';

// --------------- Context ---------------

export interface DesignTokenContextValue {
  /** The currently resolved theme object. */
  theme: ResolvedTheme;
  /** Lookup a single token value by name. */
  getToken(name: string): string | undefined;
  /** The raw CSS variable map (token-name -> value). */
  tokens: Record<string, string>;
}

const DesignTokenContext = createContext<DesignTokenContextValue | null>(null);

// --------------- Hook ---------------

export function useDesignTokens(): DesignTokenContextValue {
  const ctx = useContext(DesignTokenContext);
  if (!ctx) {
    throw new Error(
      'useDesignTokens must be used within a <DesignTokenProvider>.'
    );
  }
  return ctx;
}

// --------------- Props ---------------

export interface DesignTokenProviderProps {
  /** A COIF signal that emits resolved theme snapshots. */
  themeSignal: Signal<ResolvedTheme>;
  /** Optional additional class name for the wrapper div. */
  className?: string;
  /** Optional inline styles merged onto the wrapper div. */
  style?: CSSProperties;
  children: ReactNode;
}

// --------------- Helpers ---------------

/**
 * Convert a dot-separated or camelCase token name to a CSS
 * custom property name:  "color.primary" -> "--color-primary"
 */
function tokenNameToCssVar(name: string): string {
  return (
    '--' +
    name
      .replace(/\./g, '-')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
  );
}

/**
 * Build a CSSProperties object that maps every resolved token
 * to a CSS custom property.  React accepts arbitrary custom
 * properties when the key starts with "--".
 */
function tokensToCssProperties(
  tokens: Record<string, string>
): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) {
    vars[tokenNameToCssVar(name)] = value;
  }
  return vars as CSSProperties;
}

// --------------- Component ---------------

export const DesignTokenProvider: React.FC<DesignTokenProviderProps> = ({
  themeSignal,
  className,
  style,
  children,
}) => {
  // --- Subscribe to the COIF signal using React 18's
  //     useSyncExternalStore for tear-free reads. ---

  const subscribe = useCallback(
    (onStoreChange: () => void) => themeSignal.subscribe(onStoreChange),
    [themeSignal]
  );

  const getSnapshot = useCallback(() => themeSignal.get(), [themeSignal]);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // --- Derive the CSS variable map and context value. ---

  const cssVars = useMemo(
    () => tokensToCssProperties(theme.tokens),
    [theme]
  );

  const contextValue = useMemo<DesignTokenContextValue>(
    () => ({
      theme,
      tokens: theme.tokens,
      getToken: (name: string) => theme.tokens[name],
    }),
    [theme]
  );

  // --- Merge caller styles with the generated CSS vars. ---

  const mergedStyle = useMemo<CSSProperties>(
    () => ({ ...cssVars, ...style }),
    [cssVars, style]
  );

  return (
    <DesignTokenContext.Provider value={contextValue}>
      <div
        className={className}
        style={mergedStyle}
        data-coif-token-root=""
      >
        {children}
      </div>
    </DesignTokenContext.Provider>
  );
};

DesignTokenProvider.displayName = 'DesignTokenProvider';

export { DesignTokenContext };
export default DesignTokenProvider;
