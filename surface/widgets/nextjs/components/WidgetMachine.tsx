'use client';

// ============================================================
// WidgetMachine — Next.js headless widget state machine component.
//
// Takes a WidgetSpec, spawns a headless state machine, calls
// connect() to obtain anatomy part props, and renders each part
// via a render function. Functional component only — no classes.
// Maps framework-neutral props to Next.js React props.
// ============================================================

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react';

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  Signal,
} from '../../shared/types.js';
import { createMachine } from '../../shared/surface-bridge.js';

interface MachineInstance {
  readonly state: Signal<MachineState>;
  readonly send: (event: { type: string; [key: string]: unknown }) => void;
  readonly connect: () => ConnectedProps;
  readonly destroy: () => void;
}

export interface WidgetRenderAPI {
  readonly state: string;
  readonly machineState: MachineState;
  readonly connectedProps: ConnectedProps;
  readonly send: (event: { type: string; [key: string]: unknown }) => void;
  readonly getPartProps: (partName: string) => Record<string, unknown>;
}

export interface WidgetMachineProps {
  readonly spec: WidgetSpec;
  readonly initialContext?: Record<string, unknown>;
  readonly children: (api: WidgetRenderAPI) => ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

const normalizeEventKey = (key: string): string => {
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
  return key.replace(/^on([a-z])/, (_, ch) => `on${ch.toUpperCase()}`);
};

const neutralToReactProps = (
  props: Record<string, unknown>,
  send: (event: { type: string; [key: string]: unknown }) => void
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;

    if (typeof value === 'string' && key.startsWith('on')) {
      const eventType = value;
      const reactKey = normalizeEventKey(key);
      result[reactKey] = () => send({ type: eventType });
      continue;
    }

    if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role') {
      result[key] = value;
      continue;
    }

    result[key] = value;
  }

  return result;
};

export const WidgetMachine = ({
  spec,
  initialContext,
  children,
  className,
  style,
}: WidgetMachineProps): ReactNode => {
  const machineRef = useRef<MachineInstance | null>(null);

  if (!machineRef.current) {
    machineRef.current = createMachine(spec, initialContext);
  }

  const machine = machineRef.current;

  useEffect(() => {
    return () => {
      machineRef.current?.destroy();
      machineRef.current = null;
    };
  }, []);

  const subscribe = useCallback(
    (cb: () => void) => machine.state.subscribe(cb),
    [machine]
  );

  const getSnapshot = useCallback(
    () => machine.state.get(),
    [machine]
  );

  const machineState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const connectedProps = useMemo(
    () => machine.connect(),
    [machine, machineState]
  );

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

  const rendered = children(api);

  if (className || style) {
    return (
      <div
        className={className}
        style={style}
        data-surface-widget=""
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
