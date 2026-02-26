// ============================================================
// Clef Surface Ink Widget — SurfaceRoot
//
// Terminal surface manager. Handles alternate screen buffer
// management, cursor visibility, raw mode, cleanup on exit,
// and provides the top-level rendering context for terminal
// Clef Surface widgets. Acts as the terminal equivalent of a DOM root.
// ============================================================

import type { SurfaceKind, WritableSignal } from '../../shared/types.js';
import { createSignal } from '../../shared/surface-bridge.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg, hexToAnsiBg } from './DesignTokenProvider.js';

// --- ANSI Escape Sequences for Terminal Control ---

const ESC = '\x1b';

/** Enter alternate screen buffer. */
const ALT_SCREEN_ENTER = `${ESC}[?1049h`;
/** Leave alternate screen buffer. */
const ALT_SCREEN_LEAVE = `${ESC}[?1049l`;

/** Hide cursor. */
const CURSOR_HIDE = `${ESC}[?25l`;
/** Show cursor. */
const CURSOR_SHOW = `${ESC}[?25h`;

/** Move cursor to position (1-indexed). */
function cursorTo(row: number, col: number): string {
  return `${ESC}[${row};${col}H`;
}

/** Clear entire screen. */
const CLEAR_SCREEN = `${ESC}[2J`;
/** Clear from cursor to end of screen. */
const CLEAR_TO_END = `${ESC}[J`;
/** Clear current line. */
const CLEAR_LINE = `${ESC}[2K`;

/** Save cursor position. */
const CURSOR_SAVE = `${ESC}7`;
/** Restore cursor position. */
const CURSOR_RESTORE = `${ESC}8`;

/** Reset all terminal attributes. */
const ANSI_RESET = `${ESC}[0m`;
const ANSI_BOLD = `${ESC}[1m`;
const ANSI_DIM = `${ESC}[2m`;

// --- Surface State ---

export type SurfaceState = 'idle' | 'active' | 'suspended' | 'destroyed';

interface SurfaceStatus {
  state: SurfaceState;
  altScreen: boolean;
  cursorVisible: boolean;
  rawMode: boolean;
  width: number;
  height: number;
}

// --- SurfaceRoot Props ---

export interface SurfaceRootProps {
  /** Whether to use alternate screen buffer. */
  altScreen?: boolean;
  /** Whether to hide the cursor. */
  hideCursor?: boolean;
  /** Whether to enable raw mode on stdin. */
  rawMode?: boolean;
  /** Whether to clear the screen on start. */
  clearOnStart?: boolean;
  /** Whether to restore terminal state on exit. */
  cleanupOnExit?: boolean;
  /** Title for the terminal window (if supported). */
  title?: string;
  /** Background color for the surface (hex). */
  backgroundColor?: string;
  /** Foreground color for the surface (hex). */
  foregroundColor?: string;
  /** Child nodes to render. */
  children: (TerminalNode | string)[];
  /** Whether to show a status bar at the bottom. */
  showStatusBar?: boolean;
  /** Custom status bar content. */
  statusBarContent?: string;
  /** Whether to show the surface kind indicator. */
  showSurfaceKind?: boolean;
  /** Width override (defaults to terminal width). */
  width?: number;
  /** Height override (defaults to terminal height). */
  height?: number;
}

/**
 * Creates a SurfaceRoot terminal node.
 *
 * This is the top-level wrapper for terminal Clef Surface rendering.
 * It provides the rendering context and surface configuration
 * as node metadata. The actual terminal control sequences are
 * managed by SurfaceRootInteractive.
 */
export function createSurfaceRoot(props: SurfaceRootProps): TerminalNode {
  const {
    altScreen = false,
    hideCursor = false,
    children,
    showStatusBar = false,
    statusBarContent,
    showSurfaceKind = false,
    backgroundColor,
    foregroundColor,
    width,
    height,
    title,
  } = props;

  const surfaceWidth = width || getTerminalWidth();
  const surfaceHeight = height || getTerminalHeight();

  const result: (TerminalNode | string)[] = [];

  // Surface kind indicator
  if (showSurfaceKind) {
    result.push({
      type: 'text',
      props: { role: 'surface-kind' },
      children: [`${ANSI_DIM}[surface: terminal | ${surfaceWidth}x${surfaceHeight}]${ANSI_RESET}`],
    });
  }

  // Title bar (if provided)
  if (title) {
    const titleBar = buildTitleBar(title, surfaceWidth, foregroundColor);
    result.push(titleBar);
  }

  // Main content area with optional background
  const contentNode: TerminalNode = {
    type: 'box',
    props: {
      role: 'surface-content',
      flexDirection: 'column',
      width: surfaceWidth,
      height: showStatusBar ? surfaceHeight - 2 : surfaceHeight,
      backgroundColor,
      foregroundColor,
    },
    children,
  };
  result.push(contentNode);

  // Status bar
  if (showStatusBar) {
    const statusBar = buildSurfaceStatusBar(
      statusBarContent,
      surfaceWidth,
      backgroundColor,
    );
    result.push(statusBar);
  }

  return {
    type: 'box',
    props: {
      role: 'surface-root',
      surfaceKind: 'terminal' as SurfaceKind,
      altScreen,
      hideCursor,
      width: surfaceWidth,
      height: surfaceHeight,
      flexDirection: 'column',
    },
    children: result,
  };
}

// --- Title Bar ---

function buildTitleBar(
  title: string,
  width: number,
  foregroundColor?: string,
): TerminalNode {
  const fgAnsi = foregroundColor ? hexToAnsiFg(foregroundColor) : '';
  const paddedTitle = ` ${title} `;
  const fillWidth = Math.max(0, width - paddedTitle.length);
  const leftFill = Math.floor(fillWidth / 2);
  const rightFill = fillWidth - leftFill;

  const titleLine = `${ANSI_DIM}${'─'.repeat(leftFill)}${ANSI_RESET}${fgAnsi}${ANSI_BOLD}${paddedTitle}${ANSI_RESET}${ANSI_DIM}${'─'.repeat(rightFill)}${ANSI_RESET}`;

  return {
    type: 'text',
    props: { role: 'surface-title' },
    children: [titleLine],
  };
}

// --- Status Bar ---

function buildSurfaceStatusBar(
  content?: string,
  width?: number,
  backgroundColor?: string,
): TerminalNode {
  const barWidth = width || getTerminalWidth();
  const bgAnsi = backgroundColor ? hexToAnsiBg(backgroundColor) : '\x1b[100m'; // Default gray bg

  const statusText = content || `${ANSI_DIM}Clef Surface Terminal Surface${ANSI_RESET}`;
  const separator = `${ANSI_DIM}${'─'.repeat(barWidth)}${ANSI_RESET}`;

  return {
    type: 'box',
    props: { role: 'surface-status-bar', flexDirection: 'column' },
    children: [
      { type: 'text', props: {}, children: [separator] },
      {
        type: 'text',
        props: { background: true },
        children: [`${bgAnsi} ${statusText} ${' '.repeat(Math.max(0, barWidth - stripAnsi(statusText).length - 2))}${ANSI_RESET}`],
      },
    ],
  };
}

// --- Interactive SurfaceRoot ---

export class SurfaceRootInteractive {
  private state: SurfaceState = 'idle';
  private status: SurfaceStatus;
  private signal: WritableSignal<SurfaceStatus>;
  private cleanupHandlers: Array<() => void> = [];
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private props: SurfaceRootProps;

  constructor(props: SurfaceRootProps) {
    this.props = props;
    this.status = {
      state: 'idle',
      altScreen: false,
      cursorVisible: true,
      rawMode: false,
      width: getTerminalWidth(),
      height: getTerminalHeight(),
    };
    this.signal = createSignal(this.status);
  }

  /** Activate the surface: enter alt screen, hide cursor, set raw mode. */
  activate(): void {
    if (this.state !== 'idle') return;
    this.state = 'active';

    const stdout = getStdout();
    if (!stdout) return;

    // Enter alternate screen buffer
    if (this.props.altScreen) {
      stdout.write(ALT_SCREEN_ENTER);
      this.status.altScreen = true;
    }

    // Hide cursor
    if (this.props.hideCursor) {
      stdout.write(CURSOR_HIDE);
      this.status.cursorVisible = false;
    }

    // Clear screen
    if (this.props.clearOnStart) {
      stdout.write(CLEAR_SCREEN);
      stdout.write(cursorTo(1, 1));
    }

    // Set window title
    if (this.props.title) {
      stdout.write(`${ESC}]0;${this.props.title}\x07`);
    }

    // Enable raw mode
    if (this.props.rawMode && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      this.status.rawMode = true;
    }

    // Register cleanup on exit
    if (this.props.cleanupOnExit) {
      this.registerExitHandlers();
    }

    // Listen for resize events
    if (stdout.on) {
      const resizeHandler = () => {
        this.status.width = getTerminalWidth();
        this.status.height = getTerminalHeight();
        this.signal.set({ ...this.status });
        this.notify();
      };
      stdout.on!('resize', resizeHandler);
      this.cleanupHandlers.push(() => {
        stdout.removeListener!('resize', resizeHandler);
      });
    }

    this.status.state = 'active';
    this.signal.set({ ...this.status });
    this.notify();
  }

  /** Suspend the surface (e.g., when backgrounding). */
  suspend(): void {
    if (this.state !== 'active') return;
    this.state = 'suspended';

    const stdout = getStdout();
    if (!stdout) return;

    // Show cursor while suspended
    stdout.write(CURSOR_SHOW);
    this.status.cursorVisible = true;

    // Leave alt screen while suspended
    if (this.status.altScreen) {
      stdout.write(ALT_SCREEN_LEAVE);
    }

    this.status.state = 'suspended';
    this.signal.set({ ...this.status });
  }

  /** Resume from suspended state. */
  resume(): void {
    if (this.state !== 'suspended') return;
    this.state = 'active';

    const stdout = getStdout();
    if (!stdout) return;

    // Re-enter alt screen
    if (this.props.altScreen) {
      stdout.write(ALT_SCREEN_ENTER);
      this.status.altScreen = true;
    }

    // Re-hide cursor
    if (this.props.hideCursor) {
      stdout.write(CURSOR_HIDE);
      this.status.cursorVisible = false;
    }

    this.status.state = 'active';
    this.signal.set({ ...this.status });
    this.notify();
  }

  /** Write content at a specific position (1-indexed row/col). */
  writeAt(row: number, col: number, content: string): void {
    const stdout = getStdout();
    if (!stdout) return;
    stdout.write(CURSOR_SAVE);
    stdout.write(cursorTo(row, col));
    stdout.write(content);
    stdout.write(CURSOR_RESTORE);
  }

  /** Clear a specific region of the terminal. */
  clearRegion(startRow: number, endRow: number): void {
    const stdout = getStdout();
    if (!stdout) return;
    for (let row = startRow; row <= endRow; row++) {
      stdout.write(cursorTo(row, 1));
      stdout.write(CLEAR_LINE);
    }
  }

  /** Get the current surface status. */
  getStatus(): SurfaceStatus {
    return { ...this.status };
  }

  /** Get the status signal. */
  getSignal(): WritableSignal<SurfaceStatus> {
    return this.signal;
  }

  /** Check if surface is currently active. */
  isActive(): boolean {
    return this.state === 'active';
  }

  /** Get terminal dimensions. */
  getDimensions(): { width: number; height: number } {
    return {
      width: this.status.width,
      height: this.status.height,
    };
  }

  handleKey(key: string): boolean {
    // SurfaceRoot handles suspension/quit
    if (key === 'q' && this.state === 'active') {
      this.destroy();
      return true;
    }
    return false;
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    return createSurfaceRoot({
      ...this.props,
      width: this.status.width,
      height: this.status.height,
    });
  }

  /** Destroy the surface and restore terminal state. */
  destroy(): void {
    if (this.state === 'destroyed') return;
    this.state = 'destroyed';

    const stdout = getStdout();
    if (stdout) {
      // Restore cursor
      stdout.write(CURSOR_SHOW);

      // Leave alternate screen
      if (this.status.altScreen) {
        stdout.write(ALT_SCREEN_LEAVE);
      }

      // Reset terminal attributes
      stdout.write(ANSI_RESET);
    }

    // Restore raw mode
    if (this.status.rawMode && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }

    // Run cleanup handlers
    for (const handler of this.cleanupHandlers) {
      handler();
    }
    this.cleanupHandlers = [];

    this.status.state = 'destroyed';
    this.signal.set({ ...this.status });
    this.listeners.clear();
  }

  private registerExitHandlers(): void {
    const cleanup = () => {
      this.destroy();
    };

    // Handle various exit signals
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
    process.on('uncaughtException', (...args: unknown[]) => {
      cleanup();
      console.error(args[0]);
      process.exit(1);
    });

    this.cleanupHandlers.push(() => {
      process.removeListener('exit', cleanup);
    });
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}

// --- Terminal Helpers ---

interface WritableOutput {
  write(data: string): boolean;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  columns?: number;
  rows?: number;
}

function getStdout(): WritableOutput | null {
  if (typeof process !== 'undefined' && process.stdout) {
    return process.stdout as unknown as WritableOutput;
  }
  return null;
}

function getTerminalWidth(): number {
  if (typeof process !== 'undefined' && process.stdout?.columns) {
    return process.stdout.columns;
  }
  return 80;
}

function getTerminalHeight(): number {
  if (typeof process !== 'undefined' && process.stdout?.rows) {
    return process.stdout.rows;
  }
  return 24;
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// --- Exported Terminal Control Sequences ---

export const terminalControl = {
  ALT_SCREEN_ENTER,
  ALT_SCREEN_LEAVE,
  CURSOR_HIDE,
  CURSOR_SHOW,
  CLEAR_SCREEN,
  CLEAR_TO_END,
  CLEAR_LINE,
  CURSOR_SAVE,
  CURSOR_RESTORE,
  cursorTo,
} as const;
