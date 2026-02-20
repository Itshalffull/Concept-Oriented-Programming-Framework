// ============================================================
// COIF Ink Widget — BindingProvider
//
// Manages COIF concept binding in terminal context. Renders
// a status bar showing the connection state (connected,
// disconnected, loading, error) and provides signal-based
// data flow between COIF concepts and terminal widgets.
// ============================================================

import type {
  BindingConfig,
  BindingMode,
  Signal,
  WritableSignal,
} from '../../shared/types.js';

import { createSignal } from '../../shared/coif-bridge.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_GREEN_FG = '\x1b[32m';
const ANSI_RED_FG = '\x1b[31m';
const ANSI_YELLOW_FG = '\x1b[33m';
const ANSI_CYAN_FG = '\x1b[36m';
const ANSI_MAGENTA_FG = '\x1b[35m';

// --- Connection State ---

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'stale';

interface ConnectionStatus {
  state: ConnectionState;
  message?: string;
  lastSync?: number;
  errorCount?: number;
}

// --- Status Icons ---

const CONNECTION_ICONS: Record<ConnectionState, string> = {
  disconnected: '\u25cb', // ○
  connecting: '\u25d4',   // ◔
  connected: '\u25cf',    // ●
  error: '\u2716',        // ✖
  stale: '\u25d2',        // ◒
};

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  disconnected: ANSI_DIM,
  connecting: ANSI_YELLOW_FG,
  connected: ANSI_GREEN_FG,
  error: ANSI_RED_FG,
  stale: ANSI_YELLOW_FG,
};

// --- Mode Labels ---

const MODE_LABELS: Record<BindingMode, string> = {
  coupled: 'Coupled',
  rest: 'REST',
  graphql: 'GraphQL',
  static: 'Static',
};

const MODE_ICONS: Record<BindingMode, string> = {
  coupled: '\u21c4',  // ⇄
  rest: '\u21bb',     // ↻
  graphql: '\u25c6',  // ◆
  static: '\u25a0',   // ■
};

// --- BindingProvider Props ---

export interface BindingProviderProps {
  /** COIF binding configuration. */
  binding: BindingConfig;
  /** Current connection state. */
  connectionState?: ConnectionState;
  /** Error message if in error state. */
  errorMessage?: string;
  /** Child nodes to wrap. */
  children: (TerminalNode | string)[];
  /** Whether to show the status bar. */
  showStatusBar?: boolean;
  /** Position of the status bar. */
  statusBarPosition?: 'top' | 'bottom';
  /** Whether to show signal values in debug mode. */
  showSignals?: boolean;
  /** Width in columns. */
  width?: number;
  /** Last sync timestamp. */
  lastSync?: number;
  /** Accent color (hex). */
  accentColor?: string;
}

/**
 * Creates a BindingProvider terminal node.
 *
 * Wraps children with binding context and optionally renders
 * a status bar showing connection state.
 */
export function createBindingProvider(props: BindingProviderProps): TerminalNode {
  const {
    binding,
    connectionState = 'disconnected',
    errorMessage,
    children,
    showStatusBar = true,
    statusBarPosition = 'bottom',
    showSignals = false,
    width,
    lastSync,
    accentColor,
  } = props;

  const result: (TerminalNode | string)[] = [];
  const statusBar = showStatusBar
    ? buildStatusBar(binding, connectionState, errorMessage, lastSync, width, accentColor)
    : null;

  // Signal debug display
  const signalDebug = showSignals
    ? buildSignalDebug(binding)
    : null;

  if (statusBar && statusBarPosition === 'top') {
    result.push(statusBar);
  }

  if (signalDebug) {
    result.push(signalDebug);
  }

  result.push(...children);

  if (statusBar && statusBarPosition === 'bottom') {
    result.push(statusBar);
  }

  return {
    type: 'box',
    props: {
      role: 'binding-provider',
      concept: binding.concept,
      mode: binding.mode,
      connectionState,
      flexDirection: 'column',
      width,
    },
    children: result,
  };
}

// --- Status Bar Builder ---

function buildStatusBar(
  binding: BindingConfig,
  state: ConnectionState,
  errorMessage?: string,
  lastSync?: number,
  width?: number,
  accentColor?: string,
): TerminalNode {
  const icon = CONNECTION_ICONS[state];
  const color = CONNECTION_COLORS[state];
  const modeLabel = MODE_LABELS[binding.mode];
  const modeIcon = MODE_ICONS[binding.mode];
  const accentAnsi = accentColor ? hexToAnsiFg(accentColor) : ANSI_CYAN_FG;

  let statusContent = `${color}${icon}${ANSI_RESET} `;
  statusContent += `${accentAnsi}${binding.concept}${ANSI_RESET} `;
  statusContent += `${ANSI_DIM}${modeIcon} ${modeLabel}${ANSI_RESET}`;

  if (binding.endpoint) {
    statusContent += ` ${ANSI_DIM}\u2192 ${binding.endpoint}${ANSI_RESET}`;
  }

  if (state === 'error' && errorMessage) {
    statusContent += ` ${ANSI_RED_FG}${errorMessage}${ANSI_RESET}`;
  }

  if (lastSync) {
    const elapsed = Date.now() - lastSync;
    const timeAgo = formatTimeAgo(elapsed);
    statusContent += ` ${ANSI_DIM}(${timeAgo})${ANSI_RESET}`;
  }

  // Signal count
  const signalCount = Object.keys(binding.signalMap).length;
  statusContent += ` ${ANSI_DIM}[${signalCount} signals]${ANSI_RESET}`;

  // Build the status bar line
  const barWidth = width || 60;
  const separator = `${ANSI_DIM}${'─'.repeat(barWidth)}${ANSI_RESET}`;

  return {
    type: 'box',
    props: { role: 'binding-status-bar', connectionState: state },
    children: [
      { type: 'text', props: {}, children: [separator] },
      { type: 'text', props: {}, children: [statusContent] },
    ],
  };
}

function buildSignalDebug(binding: BindingConfig): TerminalNode {
  const signalEntries: (TerminalNode | string)[] = [
    {
      type: 'text',
      props: { role: 'signal-debug-header' },
      children: [`${ANSI_DIM}Signals:${ANSI_RESET}`],
    },
  ];

  for (const [name, signal] of Object.entries(binding.signalMap)) {
    const value = signal.get();
    const displayValue = formatSignalValue(value);
    signalEntries.push({
      type: 'text',
      props: { role: 'signal-entry', signalName: name, signalId: signal.id },
      children: [
        `  ${ANSI_MAGENTA_FG}\u25b8${ANSI_RESET} ${ANSI_BOLD}${name}${ANSI_RESET} ${ANSI_DIM}(${signal.id})${ANSI_RESET}: ${displayValue}`,
      ],
    });
  }

  return {
    type: 'box',
    props: { role: 'signal-debug', flexDirection: 'column' },
    children: signalEntries,
  };
}

// --- Helpers ---

function formatTimeAgo(ms: number): string {
  if (ms < 1000) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatSignalValue(value: unknown): string {
  if (value === null || value === undefined) return `${ANSI_DIM}null${ANSI_RESET}`;
  if (typeof value === 'boolean') return value ? `${ANSI_GREEN_FG}true${ANSI_RESET}` : `${ANSI_RED_FG}false${ANSI_RESET}`;
  if (typeof value === 'number') return `${ANSI_CYAN_FG}${value}${ANSI_RESET}`;
  if (typeof value === 'string') {
    const truncated = value.length > 30 ? value.substring(0, 27) + '...' : value;
    return `${ANSI_YELLOW_FG}"${truncated}"${ANSI_RESET}`;
  }
  if (Array.isArray(value)) return `${ANSI_DIM}Array(${value.length})${ANSI_RESET}`;
  if (typeof value === 'object') return `${ANSI_DIM}{${Object.keys(value as object).length} keys}${ANSI_RESET}`;
  return `${ANSI_DIM}${String(value)}${ANSI_RESET}`;
}

// --- Interactive BindingProvider ---

export class BindingProviderInteractive {
  private connectionState: ConnectionState;
  private connectionSignal: WritableSignal<ConnectionStatus>;
  private signalUnsubscribers: Array<() => void> = [];
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private destroyed = false;
  private props: BindingProviderProps;
  private lastSync?: number;

  constructor(props: BindingProviderProps) {
    this.props = props;
    this.connectionState = props.connectionState || 'disconnected';
    this.lastSync = props.lastSync;

    this.connectionSignal = createSignal<ConnectionStatus>({
      state: this.connectionState,
      message: props.errorMessage,
      lastSync: this.lastSync,
      errorCount: 0,
    });

    // Subscribe to binding signal changes for reactive updates
    this.subscribeToSignals();
  }

  /** Simulate connecting to the data source. */
  connect(): void {
    if (this.destroyed) return;
    this.setConnectionState('connecting');

    // The actual connection would be handled by the COIF binding layer.
    // This provides the terminal UI feedback.
  }

  /** Mark as successfully connected. */
  markConnected(): void {
    this.lastSync = Date.now();
    this.setConnectionState('connected');
  }

  /** Mark as disconnected. */
  markDisconnected(): void {
    this.setConnectionState('disconnected');
  }

  /** Mark as error state. */
  markError(message: string): void {
    this.setConnectionState('error', message);
  }

  /** Mark as stale (data may be outdated). */
  markStale(): void {
    this.setConnectionState('stale');
  }

  /** Get the current connection state. */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /** Get the connection status signal. */
  getConnectionSignal(): Signal<ConnectionStatus> {
    return this.connectionSignal;
  }

  /** Read a signal value from the binding. */
  readSignal(name: string): unknown {
    const signal = this.props.binding.signalMap[name];
    return signal ? signal.get() : undefined;
  }

  handleKey(key: string): boolean {
    // Binding provider can respond to refresh commands
    if (key === 'r' || key === 'R') {
      this.connect();
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
    return createBindingProvider({
      ...this.props,
      connectionState: this.connectionState,
      lastSync: this.lastSync,
    });
  }

  destroy(): void {
    this.destroyed = true;
    for (const unsub of this.signalUnsubscribers) {
      unsub();
    }
    this.signalUnsubscribers = [];
    this.listeners.clear();
  }

  private setConnectionState(state: ConnectionState, message?: string): void {
    this.connectionState = state;
    const current = this.connectionSignal.get();
    this.connectionSignal.set({
      ...current,
      state,
      message: message || current.message,
      lastSync: state === 'connected' ? Date.now() : current.lastSync,
      errorCount: state === 'error' ? (current.errorCount || 0) + 1 : current.errorCount,
    });
    this.notify();
  }

  private subscribeToSignals(): void {
    for (const signal of Object.values(this.props.binding.signalMap)) {
      const unsub = signal.subscribe(() => {
        if (!this.destroyed) this.notify();
      });
      this.signalUnsubscribers.push(unsub);
    }
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}
