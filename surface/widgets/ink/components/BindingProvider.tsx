// ============================================================
// Clef Surface Ink Widget — BindingProvider
//
// Manages Clef Surface concept binding in terminal context
// using Ink. Renders a status bar showing connection state
// and provides signal-based data flow via React context.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { Box, Text, useInput } from 'ink';

import type {
  BindingConfig,
  BindingMode,
  Signal,
} from '../../shared/types.js';

// --------------- Types ---------------

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'stale';

const CONNECTION_ICONS: Record<ConnectionState, string> = {
  disconnected: '○', connecting: '◔', connected: '●', error: '✖', stale: '◒',
};

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  disconnected: 'gray', connecting: 'yellow', connected: 'green', error: 'red', stale: 'yellow',
};

const MODE_LABELS: Record<BindingMode, string> = {
  coupled: 'Coupled', rest: 'REST', graphql: 'GraphQL', static: 'Static',
};

const MODE_ICONS: Record<BindingMode, string> = {
  coupled: '⇄', rest: '↻', graphql: '◆', static: '■',
};

// --------------- Context ---------------

export interface BindingContextValue {
  binding: BindingConfig;
  connectionState: ConnectionState;
  readSignal(name: string): unknown;
  invoke(action: string, params?: Record<string, unknown>): Promise<void>;
}

export type InvokeFn = (action: string, params?: Record<string, unknown>) => Promise<void>;

const BindingContext = createContext<BindingContextValue | null>(null);

export function useBinding(): BindingContextValue {
  const ctx = useContext(BindingContext);
  if (!ctx) {
    throw new Error('useBinding must be used within a <BindingProvider>.');
  }
  return ctx;
}

export function useBoundSignal(name: string): unknown {
  const { binding } = useBinding();
  const signal = binding.signalMap[name];
  const [value, setValue] = useState(signal?.get());

  useEffect(() => {
    if (!signal) return;
    setValue(signal.get());
    return signal.subscribe((v) => setValue(v));
  }, [signal]);

  return value;
}

// --------------- Props ---------------

export interface BindingProviderProps {
  /** Clef Surface binding configuration. */
  binding: BindingConfig;
  /** Current connection state. */
  connectionState?: ConnectionState;
  /** Error message if in error state. */
  errorMessage?: string;
  /** Children to wrap. */
  children: ReactNode;
  /** Whether to show the status bar. */
  showStatusBar?: boolean;
  /** Position of the status bar. */
  statusBarPosition?: 'top' | 'bottom';
  /** Whether to show signal values. */
  showSignals?: boolean;
  /** Width in columns. */
  width?: number;
  /** Last sync timestamp. */
  lastSync?: number;
  /** Accent color. */
  accentColor?: string;
  /** Whether this component is focused. */
  isFocused?: boolean;
  /** Custom invoke handler. */
  onInvoke?: InvokeFn;
}

// --------------- Helpers ---------------

function formatTimeAgo(ms: number): string {
  if (ms < 1000) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// --------------- Component ---------------

export const BindingProvider: React.FC<BindingProviderProps> = ({
  binding,
  connectionState: initialState = 'disconnected',
  errorMessage,
  children,
  showStatusBar = true,
  statusBarPosition = 'bottom',
  showSignals = false,
  width,
  lastSync,
  accentColor = 'cyan',
  isFocused = false,
  onInvoke,
}) => {
  const [connState, setConnState] = useState(initialState);

  useInput(
    (input) => {
      if (input === 'r' || input === 'R') {
        setConnState('connecting');
      }
    },
    { isActive: isFocused },
  );

  const invoke: InvokeFn = useCallback(
    async (action, params) => {
      if (onInvoke) return onInvoke(action, params);
    },
    [onInvoke],
  );

  const contextValue = useMemo<BindingContextValue>(
    () => ({
      binding,
      connectionState: connState,
      readSignal: (name: string) => binding.signalMap[name]?.get(),
      invoke,
    }),
    [binding, connState, invoke],
  );

  const signalCount = Object.keys(binding.signalMap).length;
  const barWidth = width || 60;

  const statusBar = showStatusBar ? (
    <Box flexDirection="column">
      <Text dimColor>{'─'.repeat(barWidth)}</Text>
      <Box>
        <Text color={CONNECTION_COLORS[connState]}>
          {CONNECTION_ICONS[connState]}
        </Text>
        <Text> </Text>
        <Text color={accentColor}>{binding.concept}</Text>
        <Text> </Text>
        <Text dimColor>
          {MODE_ICONS[binding.mode]} {MODE_LABELS[binding.mode]}
        </Text>
        {binding.endpoint && (
          <Text dimColor> → {binding.endpoint}</Text>
        )}
        {connState === 'error' && errorMessage && (
          <Text color="red"> {errorMessage}</Text>
        )}
        {lastSync && (
          <Text dimColor> ({formatTimeAgo(Date.now() - lastSync)})</Text>
        )}
        <Text dimColor> [{signalCount} signals]</Text>
      </Box>
    </Box>
  ) : null;

  const signalDebug = showSignals ? (
    <Box flexDirection="column">
      <Text dimColor>Signals:</Text>
      {Object.entries(binding.signalMap).map(([name, signal]) => {
        const value = signal.get();
        return (
          <Box key={name}>
            <Text>  </Text>
            <Text color="magenta">▸ </Text>
            <Text bold>{name}</Text>
            <Text dimColor> ({signal.id}): </Text>
            <SignalValue value={value} />
          </Box>
        );
      })}
    </Box>
  ) : null;

  return (
    <BindingContext.Provider value={contextValue}>
      <Box flexDirection="column" width={width}>
        {statusBar && statusBarPosition === 'top' && statusBar}
        {signalDebug}
        {children}
        {statusBar && statusBarPosition === 'bottom' && statusBar}
      </Box>
    </BindingContext.Provider>
  );
};

const SignalValue: React.FC<{ value: unknown }> = ({ value }) => {
  if (value === null || value === undefined) return <Text dimColor>null</Text>;
  if (typeof value === 'boolean') {
    return <Text color={value ? 'green' : 'red'}>{String(value)}</Text>;
  }
  if (typeof value === 'number') return <Text color="cyan">{value}</Text>;
  if (typeof value === 'string') {
    const truncated = value.length > 30 ? value.substring(0, 27) + '...' : value;
    return <Text color="yellow">"{truncated}"</Text>;
  }
  if (Array.isArray(value)) return <Text dimColor>Array({value.length})</Text>;
  if (typeof value === 'object') {
    return <Text dimColor>{'{' + Object.keys(value as object).length + ' keys}'}</Text>;
  }
  return <Text dimColor>{String(value)}</Text>;
};

BindingProvider.displayName = 'BindingProvider';
export { BindingContext };
export default BindingProvider;
