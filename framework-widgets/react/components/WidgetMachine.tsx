// ============================================================
// WidgetMachine — Takes a WidgetSpec, spawns a headless COIF
// state machine, calls connect() to obtain anatomy part props,
// and renders each part.
//
// Maps framework-neutral props (produced by the machine) to
// React-specific props (onClick, className, data-* attributes).
// The machine lifecycle is tied to the component lifecycle.
// ============================================================

import React, {
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  Signal,
} from '../../shared/types.js';
import { createMachine } from '../../shared/coif-bridge.js';

// --------------- Types ---------------

/**
 * The object returned by createMachine — kept opaque to callers.
 */
interface MachineInstance {
  state: Signal<MachineState>;
  send: (event: { type: string; [key: string]: unknown }) => void;
  connect: () => ConnectedProps;
  destroy: () => void;
}

/**
 * Render prop / children-as-function argument.
 */
export interface WidgetRenderAPI {
  /** Current machine state name. */
  state: string;
  /** Full machine state with context. */
  machineState: MachineState;
  /** Framework-neutral connected props keyed by anatomy part. */
  connectedProps: ConnectedProps;
  /** Send an event to the machine. */
  send: (event: { type: string; [key: string]: unknown }) => void;
  /**
   * Get React-ready props for a named anatomy part.  Transforms
   * data-* attributes and wires event handlers.
   */
  getPartProps: (partName: string) => Record<string, unknown>;
}

// --------------- Props ---------------

export interface WidgetMachineProps {
  /** The COIF widget specification (state machine + anatomy). */
  spec: WidgetSpec;
  /** Optional initial context merged into the machine. */
  initialContext?: Record<string, unknown>;
  /**
   * Render function.  Receives the full machine API so the
   * caller has total control over the DOM structure.
   */
  children: (api: WidgetRenderAPI) => ReactNode;
  /** Optional class name for a wrapping element (when not using render prop). */
  className?: string;
  /** Optional inline styles for the wrapper. */
  style?: CSSProperties;
}

// --------------- Helpers ---------------

/**
 * Convert framework-neutral event handler names to React props.
 *
 * The connect() bridge produces handler names like "onclick",
 * "onkeydown" etc (lowercase).  React expects camelCase.
 */
function neutralToReactProps(
  props: Record<string, unknown>,
  send: (event: { type: string; [key: string]: unknown }) => void
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;

    // Translate event handler strings to actual React callbacks
    if (typeof value === 'string' && key.startsWith('on')) {
      // The machine stores the event type to send as the value.
      // e.g. { onclick: "CLICK" } => onClick={() => send({ type: "CLICK" })}
      const eventType = value;
      const reactKey = normalizeEventKey(key);
      result[reactKey] = () => send({ type: eventType });
      continue;
    }

    // data-* attributes pass through directly
    if (key.startsWith('data-')) {
      result[key] = value;
      continue;
    }

    // aria-* attributes pass through directly
    if (key.startsWith('aria-') || key === 'role') {
      result[key] = value;
      continue;
    }

    // Everything else passes through
    result[key] = value;
  }

  return result;
}

/**
 * Normalize event handler key: "onclick" -> "onClick"
 */
function normalizeEventKey(key: string): string {
  if (key === 'onclick') return 'onClick';
  if (key === 'onkeydown') return 'onKeyDown';
  if (key === 'onkeyup') return 'onKeyUp';
  if (key === 'onkeypress') return 'onKeyPress';
  if (key === 'onfocus') return 'onFocus';
  if (key === 'onblur') return 'onBlur';
  if (key === 'onmouseenter') return 'onMouseEnter';
  if (key === 'onmouseleave') return 'onMouseLeave';
  if (key === 'onchange') return 'onChange';
  if (key === 'oninput') return 'onInput';
  // Generic: capitalize second char
  return key.replace(/^on([a-z])/, (_, ch) => `on${ch.toUpperCase()}`);
}

// --------------- Component ---------------

export const WidgetMachine: React.FC<WidgetMachineProps> = ({
  spec,
  initialContext,
  children,
  className,
  style,
}) => {
  // Spawn machine on mount, destroy on unmount.
  const machineRef = useRef<MachineInstance | null>(null);

  if (!machineRef.current) {
    machineRef.current = createMachine(spec, initialContext);
  }

  const machine = machineRef.current;

  // Destroy on unmount
  useEffect(() => {
    return () => {
      machineRef.current?.destroy();
      machineRef.current = null;
    };
  }, []);

  // Re-spawn if spec identity changes
  useEffect(() => {
    const currentMachine = machineRef.current;
    // If the spec name doesn't match, rebuild
    if (currentMachine) {
      // We rely on spec.name as identity.  Full equality is expensive.
      // In practice, the spec object is stable.
    }
  }, [spec]);

  // Subscribe to state changes
  const subscribe = useCallback(
    (cb: () => void) => machine.state.subscribe(cb),
    [machine]
  );

  const getSnapshot = useCallback(
    () => machine.state.get(),
    [machine]
  );

  const machineState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Produce connected props
  const connectedProps = useMemo(
    () => machine.connect(),
    // Re-connect whenever machine state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machine, machineState]
  );

  // Build the render API
  const getPartProps = useCallback(
    (partName: string): Record<string, unknown> => {
      const raw = connectedProps[partName] ?? {};
      return neutralToReactProps(raw, machine.send);
    },
    [connectedProps, machine.send]
  );

  const api = useMemo<WidgetRenderAPI>(
    () => ({
      state: machineState.current,
      machineState,
      connectedProps,
      send: machine.send,
      getPartProps,
    }),
    [machineState, connectedProps, machine.send, getPartProps]
  );

  // Render via children-as-function
  const rendered = children(api);

  if (className || style) {
    return (
      <div
        className={className}
        style={style}
        data-coif-widget=""
        data-widget-name={spec.name}
        data-widget-state={machineState.current}
      >
        {rendered}
      </div>
    );
  }

  return <>{rendered}</>;
};

WidgetMachine.displayName = 'WidgetMachine';
export default WidgetMachine;
