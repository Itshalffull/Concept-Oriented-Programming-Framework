// ============================================================
// Clef Surface Ink Widget — ViewportProvider
//
// Reads terminal dimensions via process.stdout and provides
// Clef Surface Breakpoint values via React context. Observes
// terminal resize events to keep viewport state current.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Box, Text } from 'ink';

import type {
  ViewportState,
  Breakpoint,
  Orientation,
} from '../../shared/types.js';

// --------------- Terminal Breakpoints ---------------

const TERMINAL_BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 40,
  md: 60,
  lg: 100,
  xl: 150,
};

function getTerminalBreakpoint(columns: number): Breakpoint {
  if (columns >= TERMINAL_BREAKPOINTS.xl) return 'xl';
  if (columns >= TERMINAL_BREAKPOINTS.lg) return 'lg';
  if (columns >= TERMINAL_BREAKPOINTS.md) return 'md';
  if (columns >= TERMINAL_BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

function getTerminalOrientation(columns: number, rows: number): Orientation {
  const effectiveHeight = rows * 2;
  return columns >= effectiveHeight ? 'landscape' : 'portrait';
}

function readTerminalDimensions(): { columns: number; rows: number } {
  if (typeof process !== 'undefined' && process.stdout) {
    return {
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }
  return { columns: 80, rows: 24 };
}

// --------------- Context ---------------

export interface ViewportContextValue {
  viewport: ViewportState;
  breakpoint: Breakpoint;
  orientation: Orientation;
  columns: number;
  rows: number;
  isAtLeast(bp: Breakpoint): boolean;
  isAtMost(bp: Breakpoint): boolean;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

export function useViewport(): ViewportContextValue {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error('useViewport must be used within a <ViewportProvider>.');
  }
  return ctx;
}

export function useBreakpoint(): Breakpoint {
  return useViewport().breakpoint;
}

// --------------- Props ---------------

export interface ViewportProviderProps {
  children: ReactNode;
  /** Override terminal dimensions (useful for testing). */
  columns?: number;
  /** Override terminal rows (useful for testing). */
  rows?: number;
  /** Whether to show a viewport info bar. */
  showInfo?: boolean;
  /** Position of the info bar. */
  infoPosition?: 'top' | 'bottom';
}

// --------------- Component ---------------

export const ViewportProvider: React.FC<ViewportProviderProps> = ({
  children,
  columns: overrideColumns,
  rows: overrideRows,
  showInfo = false,
  infoPosition = 'bottom',
}) => {
  const [dims, setDims] = useState(() => {
    if (overrideColumns !== undefined && overrideRows !== undefined) {
      return { columns: overrideColumns, rows: overrideRows };
    }
    return readTerminalDimensions();
  });

  // Observe resize events
  useEffect(() => {
    if (overrideColumns !== undefined && overrideRows !== undefined) return;
    if (typeof process === 'undefined' || !process.stdout?.on) return;

    const handler = () => setDims(readTerminalDimensions());
    process.stdout.on('resize', handler);
    return () => {
      process.stdout.removeListener('resize', handler);
    };
  }, [overrideColumns, overrideRows]);

  const viewport = useMemo<ViewportState>(() => ({
    width: dims.columns,
    height: dims.rows,
    breakpoint: getTerminalBreakpoint(dims.columns),
    orientation: getTerminalOrientation(dims.columns, dims.rows),
  }), [dims]);

  const BP_ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

  const contextValue = useMemo<ViewportContextValue>(() => ({
    viewport,
    breakpoint: viewport.breakpoint,
    orientation: viewport.orientation,
    columns: dims.columns,
    rows: dims.rows,
    isAtLeast: (bp: Breakpoint) =>
      BP_ORDER.indexOf(viewport.breakpoint) >= BP_ORDER.indexOf(bp),
    isAtMost: (bp: Breakpoint) =>
      BP_ORDER.indexOf(viewport.breakpoint) <= BP_ORDER.indexOf(bp),
  }), [viewport, dims]);

  const infoBar = showInfo ? (
    <Text dimColor>
      [viewport: {dims.columns}x{dims.rows} bp:
      <Text color="cyan">{viewport.breakpoint}</Text> {viewport.orientation}]
    </Text>
  ) : null;

  return (
    <ViewportContext.Provider value={contextValue}>
      <Box flexDirection="column">
        {showInfo && infoPosition === 'top' && infoBar}
        {children}
        {showInfo && infoPosition === 'bottom' && infoBar}
      </Box>
    </ViewportContext.Provider>
  );
};

ViewportProvider.displayName = 'ViewportProvider';
export { ViewportContext };
export default ViewportProvider;
