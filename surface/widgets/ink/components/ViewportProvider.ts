// ============================================================
// Clef Surface Ink Widget — ViewportProvider
//
// Reads terminal dimensions via process.stdout.columns/rows
// and provides Clef Surface Breakpoint values based on terminal width.
// Observes terminal resize events to keep viewport state current.
// ============================================================

import type {
  ViewportState,
  Breakpoint,
  Orientation,
  WritableSignal,
} from '../../shared/types.js';

import {
  createSignal,
  getBreakpoint,
  getOrientation,
} from '../../shared/surface-bridge.js';

import type { TerminalNode } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_CYAN_FG = '\x1b[36m';

// --- Terminal Breakpoint Mapping ---

/**
 * Terminal-specific breakpoints based on column count.
 * These map more naturally to terminal widths than the
 * pixel-based breakpoints used in browser viewports.
 */
const TERMINAL_BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,    // < 40 columns
  sm: 40,   // 40-59 columns
  md: 60,   // 60-99 columns
  lg: 100,  // 100-149 columns
  xl: 150,  // 150+ columns
};

/** Get terminal breakpoint from column count. */
export function getTerminalBreakpoint(columns: number): Breakpoint {
  if (columns >= TERMINAL_BREAKPOINTS.xl) return 'xl';
  if (columns >= TERMINAL_BREAKPOINTS.lg) return 'lg';
  if (columns >= TERMINAL_BREAKPOINTS.md) return 'md';
  if (columns >= TERMINAL_BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/** Get terminal orientation from columns/rows. */
export function getTerminalOrientation(columns: number, rows: number): Orientation {
  // Terminals are typically wider than tall
  // Use a character-aspect-ratio-adjusted comparison
  // A terminal character is roughly 2x taller than wide
  const effectiveHeight = rows * 2;
  return columns >= effectiveHeight ? 'landscape' : 'portrait';
}

// --- Read Terminal Dimensions ---

export interface TerminalDimensions {
  columns: number;
  rows: number;
}

/** Read current terminal dimensions from process.stdout. */
export function readTerminalDimensions(): TerminalDimensions {
  if (typeof process !== 'undefined' && process.stdout) {
    return {
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }
  return { columns: 80, rows: 24 };
}

/** Build a ViewportState from terminal dimensions. */
export function terminalToViewportState(dims: TerminalDimensions): ViewportState {
  return {
    width: dims.columns,
    height: dims.rows,
    breakpoint: getTerminalBreakpoint(dims.columns),
    orientation: getTerminalOrientation(dims.columns, dims.rows),
  };
}

// --- ViewportProvider Props ---

export interface ViewportProviderProps {
  /** Children to wrap with viewport context. */
  children: (TerminalNode | string)[];
  /** Override terminal dimensions (useful for testing). */
  dimensions?: TerminalDimensions;
  /** Custom breakpoint thresholds. */
  breakpoints?: Record<Breakpoint, number>;
  /** Whether to show a viewport info bar. */
  showInfo?: boolean;
  /** Position of the info bar. */
  infoPosition?: 'top' | 'bottom';
}

/**
 * Creates a ViewportProvider terminal node.
 *
 * Reads terminal dimensions and annotates the tree with
 * viewport/breakpoint information for responsive rendering.
 */
export function createViewportProvider(props: ViewportProviderProps): TerminalNode {
  const {
    children,
    dimensions,
    showInfo = false,
    infoPosition = 'bottom',
  } = props;

  const dims = dimensions || readTerminalDimensions();
  const viewport = terminalToViewportState(dims);

  const result: (TerminalNode | string)[] = [];

  // Build info bar
  const infoBar: TerminalNode = {
    type: 'text',
    props: { role: 'viewport-info' },
    children: [
      `${ANSI_DIM}[viewport: ${dims.columns}x${dims.rows} ` +
      `bp:${ANSI_RESET}${ANSI_CYAN_FG}${viewport.breakpoint}${ANSI_RESET}${ANSI_DIM} ` +
      `${viewport.orientation}]${ANSI_RESET}`,
    ],
  };

  if (showInfo && infoPosition === 'top') {
    result.push(infoBar);
  }

  result.push(...children);

  if (showInfo && infoPosition === 'bottom') {
    result.push(infoBar);
  }

  return {
    type: 'box',
    props: {
      role: 'viewport-provider',
      viewport,
      columns: dims.columns,
      rows: dims.rows,
      breakpoint: viewport.breakpoint,
      orientation: viewport.orientation,
      flexDirection: 'column',
    },
    children: result,
  };
}

// --- Interactive ViewportProvider (observes resize) ---

export class ViewportProviderInteractive {
  private viewport: ViewportState;
  private signal: WritableSignal<ViewportState>;
  private resizeCleanup: (() => void) | null = null;
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private destroyed = false;
  private props: ViewportProviderProps;

  constructor(props: ViewportProviderProps) {
    this.props = props;

    const dims = props.dimensions || readTerminalDimensions();
    this.viewport = terminalToViewportState(dims);
    this.signal = createSignal(this.viewport);

    // Start observing resize events
    this.observeResize();
  }

  /** Get the current viewport state. */
  getViewport(): ViewportState {
    return this.viewport;
  }

  /** Get the viewport signal for reactive subscriptions. */
  getSignal(): WritableSignal<ViewportState> {
    return this.signal;
  }

  /** Get the current breakpoint. */
  getBreakpoint(): Breakpoint {
    return this.viewport.breakpoint;
  }

  /** Check if the current breakpoint is at least the given size. */
  isAtLeast(breakpoint: Breakpoint): boolean {
    const order: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    return order.indexOf(this.viewport.breakpoint) >= order.indexOf(breakpoint);
  }

  /** Check if the current breakpoint is at most the given size. */
  isAtMost(breakpoint: Breakpoint): boolean {
    const order: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    return order.indexOf(this.viewport.breakpoint) <= order.indexOf(breakpoint);
  }

  /** Force a dimension check (useful after programmatic terminal resize). */
  refresh(): void {
    if (this.destroyed) return;
    const dims = readTerminalDimensions();
    this.updateDimensions(dims);
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  handleKey(_key: string): boolean {
    // ViewportProvider doesn't handle keys
    return false;
  }

  render(): TerminalNode {
    const dims = this.props.dimensions || readTerminalDimensions();
    return createViewportProvider({
      ...this.props,
      dimensions: dims,
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.resizeCleanup) {
      this.resizeCleanup();
      this.resizeCleanup = null;
    }
    this.listeners.clear();
  }

  private observeResize(): void {
    if (typeof process === 'undefined' || !process.stdout?.on) return;

    const handler = () => {
      if (this.destroyed) return;
      const dims = readTerminalDimensions();
      this.updateDimensions(dims);
    };

    process.stdout.on('resize', handler);
    this.resizeCleanup = () => {
      process.stdout.removeListener('resize', handler);
    };
  }

  private updateDimensions(dims: TerminalDimensions): void {
    const newViewport = terminalToViewportState(dims);

    // Only notify if breakpoint or orientation changed
    if (
      newViewport.breakpoint !== this.viewport.breakpoint ||
      newViewport.orientation !== this.viewport.orientation ||
      newViewport.width !== this.viewport.width ||
      newViewport.height !== this.viewport.height
    ) {
      this.viewport = newViewport;
      this.signal.set(newViewport);
      this.notify();
    }
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}
