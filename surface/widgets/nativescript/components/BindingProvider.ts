// ============================================================
// Clef Surface NativeScript Widget — BindingProvider
//
// Manages Clef Surface concept binding in NativeScript context.
// Provides connection state management and signal-based data
// flow via a global context pattern.
// ============================================================

import {
  StackLayout,
  Label,
  Color,
  Observable,
} from '@nativescript/core';

import type {
  BindingConfig,
  BindingMode,
  Signal,
} from '../../shared/types.js';

// --------------- Types ---------------

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'stale';

const CONNECTION_ICONS: Record<ConnectionState, string> = {
  disconnected: '\u25CB', connecting: '\u25D4', connected: '\u25CF', error: '\u2716', stale: '\u25D2',
};

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  disconnected: '#888888', connecting: '#eab308', connected: '#22c55e', error: '#ef4444', stale: '#eab308',
};

const MODE_LABELS: Record<BindingMode, string> = {
  coupled: 'Coupled', rest: 'REST', graphql: 'GraphQL', static: 'Static',
};

// --------------- Context ---------------

export interface BindingContextValue {
  binding: BindingConfig;
  connectionState: ConnectionState;
  readSignal(name: string): unknown;
  invoke(action: string, params?: Record<string, unknown>): Promise<void>;
}

let _currentBindingContext: BindingContextValue | null = null;

export function getBinding(): BindingContextValue {
  if (!_currentBindingContext) {
    throw new Error('getBinding must be called within a BindingProvider scope.');
  }
  return _currentBindingContext;
}

export function getBoundSignal(name: string): unknown {
  const ctx = getBinding();
  const signal = ctx.binding.signalMap[name];
  return signal?.get();
}

// --------------- Props ---------------

export interface BindingProviderProps {
  binding: BindingConfig;
  connectionState?: ConnectionState;
  errorMessage?: string;
  showStatusBar?: boolean;
  statusBarPosition?: 'top' | 'bottom';
  showSignals?: boolean;
  width?: number;
  lastSync?: string;
  onRetry?: () => void;
  onDisconnect?: () => void;
  children?: import('@nativescript/core').View[];
}

// --------------- Component ---------------

export function createBindingProvider(props: BindingProviderProps): StackLayout {
  const {
    binding,
    connectionState = 'disconnected',
    errorMessage,
    showStatusBar = true,
    statusBarPosition = 'top',
    showSignals = false,
    width,
    lastSync,
    onRetry,
    onDisconnect,
    children = [],
  } = props;

  // Set context
  _currentBindingContext = {
    binding,
    connectionState,
    readSignal: (name: string) => binding.signalMap[name]?.get(),
    invoke: async (action, params) => {
      // Placeholder for action invocation
      console.log(`BindingProvider invoke: ${action}`, params);
    },
  };

  const container = new StackLayout();
  container.className = 'clef-binding-provider';
  if (width) container.width = width;

  // Status bar
  const createStatusBar = (): StackLayout => {
    const bar = new StackLayout();
    bar.orientation = 'horizontal';
    bar.padding = 4;
    bar.backgroundColor = new Color('#1a1a2e');

    // Connection icon
    const icon = new Label();
    icon.text = CONNECTION_ICONS[connectionState];
    icon.color = new Color(CONNECTION_COLORS[connectionState]);
    icon.marginRight = 4;
    bar.addChild(icon);

    // Mode label
    const mode = new Label();
    mode.text = MODE_LABELS[binding.mode];
    mode.fontWeight = 'bold';
    mode.color = new Color('#ffffff');
    mode.marginRight = 8;
    bar.addChild(mode);

    // Concept name
    const concept = new Label();
    concept.text = String(binding.concept);
    concept.color = new Color('#06b6d4');
    bar.addChild(concept);

    // Status text
    const status = new Label();
    status.text = ` [${connectionState}]`;
    status.color = new Color(CONNECTION_COLORS[connectionState]);
    bar.addChild(status);

    // Error message
    if (connectionState === 'error' && errorMessage) {
      const errLabel = new Label();
      errLabel.text = ` \u2716 ${errorMessage}`;
      errLabel.color = new Color('#ef4444');
      bar.addChild(errLabel);
    }

    // Last sync
    if (lastSync) {
      const syncLabel = new Label();
      syncLabel.text = ` sync: ${lastSync}`;
      syncLabel.opacity = 0.5;
      syncLabel.fontSize = 11;
      bar.addChild(syncLabel);
    }

    return bar;
  };

  if (showStatusBar && statusBarPosition === 'top') {
    container.addChild(createStatusBar());
  }

  // Signal display
  if (showSignals && Object.keys(binding.signalMap).length > 0) {
    const signalContainer = new StackLayout();
    const signalHeader = new Label();
    signalHeader.text = 'Signals:';
    signalHeader.opacity = 0.5;
    signalContainer.addChild(signalHeader);

    Object.entries(binding.signalMap).forEach(([name, signal]) => {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      const nameLabel = new Label();
      nameLabel.text = `  ${name}: `;
      nameLabel.opacity = 0.5;
      row.addChild(nameLabel);
      const valueLabel = new Label();
      valueLabel.text = JSON.stringify(signal.get());
      valueLabel.color = new Color('#06b6d4');
      row.addChild(valueLabel);
      signalContainer.addChild(row);
    });

    container.addChild(signalContainer);
  }

  // Children
  for (const child of children) {
    container.addChild(child);
  }

  if (showStatusBar && statusBarPosition === 'bottom') {
    container.addChild(createStatusBar());
  }

  return container;
}

export default createBindingProvider;
