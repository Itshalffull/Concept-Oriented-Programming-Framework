// ============================================================
// WidgetMachine — Solid.js Component
//
// Headless state machine with Solid reactivity. Uses
// createSignal for machine state and native DOM events
// (not synthetic). Provides connected props for each
// anatomy part that automatically update when state changes.
// ============================================================

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  AnatomyPart,
} from '../../shared/types.js';

import {
  createMachine,
  createSignal as coifCreateSignal,
} from '../../shared/coif-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = coifCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateMemo<T>(deps: Array<() => unknown>, compute: () => T): () => T {
  let cached = compute();
  let lastValues = deps.map(d => d());

  return () => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      cached = compute();
    }
    return cached;
  };
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());

  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);

  return () => {
    clearInterval(interval);
    if (typeof cleanup === 'function') cleanup();
  };
}

// --- Component Props ---

export interface WidgetMachineProps {
  spec: WidgetSpec;
  initialContext?: Record<string, unknown>;
  renderParts?: Record<string, (partProps: Record<string, unknown>, state: MachineState) => HTMLElement>;
  class?: string;
}

// --- Component Result ---

export interface WidgetMachineResult {
  element: HTMLElement;
  dispose: () => void;
  send: (event: { type: string; [key: string]: unknown }) => void;
  state: () => MachineState;
  connectedProps: () => ConnectedProps;
  parts: Map<string, HTMLElement>;
}

// --- Component ---

export function WidgetMachine(props: WidgetMachineProps): WidgetMachineResult {
  const machine = createMachine(props.spec, props.initialContext);

  // Wrap the machine state in a Solid-style signal for reactive tracking
  const [machineState, setMachineState] = solidCreateSignal<MachineState>(machine.state.get());

  // Subscribe to machine state changes
  const unsubscribe = machine.state.subscribe((newState) => {
    setMachineState(newState);
  });

  // createMemo: derive connected props from current state
  const connectedProps = solidCreateMemo([machineState], (): ConnectedProps => {
    return machine.connect();
  });

  // Root container
  const container = document.createElement('div');
  container.setAttribute('data-coif-widget', 'widget-machine');
  container.setAttribute('data-widget-name', props.spec.name);

  if (props.class) {
    container.setAttribute('class', props.class);
  }

  // Track rendered anatomy part elements
  const parts = new Map<string, HTMLElement>();

  // Render each anatomy part
  for (const partName of props.spec.anatomy.parts) {
    let partEl: HTMLElement;

    if (props.renderParts && props.renderParts[partName]) {
      // Use custom render function
      partEl = props.renderParts[partName](
        connectedProps()[partName] ?? {},
        machineState()
      );
    } else {
      // Default: create a div for each part
      partEl = document.createElement('div');
      partEl.setAttribute('data-part', partName);
    }

    parts.set(partName, partEl);
    container.appendChild(partEl);
  }

  // Reactive effect: update part props when machine state changes
  const disposeStateEffect = solidCreateEffect([machineState], () => {
    const state = machineState();
    const props_ = connectedProps();

    // Update data attributes on the container
    container.setAttribute('data-state', state.current);

    // Update each part's attributes
    for (const [partName, partEl] of parts) {
      const partProps = props_[partName];
      if (!partProps) continue;

      for (const [key, val] of Object.entries(partProps)) {
        if (val === undefined) {
          partEl.removeAttribute(key);
        } else {
          partEl.setAttribute(key, String(val));
        }
      }
    }

    // Dispatch native DOM event on state transition
    container.dispatchEvent(
      new CustomEvent('coif:state-change', {
        bubbles: true,
        detail: {
          widget: props.spec.name,
          current: state.current,
          context: state.context,
        },
      })
    );
  });

  // Wrap the machine send with native DOM event dispatching
  function send(event: { type: string; [key: string]: unknown }) {
    const prevState = machineState().current;
    machine.send(event);

    // Dispatch native DOM event for the action
    container.dispatchEvent(
      new CustomEvent('coif:action', {
        bubbles: true,
        detail: {
          widget: props.spec.name,
          event: event.type,
          from: prevState,
          to: machineState().current,
        },
      })
    );
  }

  // Set up native DOM event listeners for part interactions
  for (const [partName, partEl] of parts) {
    // Click handler: dispatch machine events based on part name
    partEl.addEventListener('click', () => {
      send({ type: `${partName}.click` });
    });

    // Keyboard handler for accessibility
    partEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        send({ type: `${partName}.click` });
      }
      if (e.key === 'Escape') {
        send({ type: `${partName}.escape` });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        send({ type: `${partName}.arrow-down` });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        send({ type: `${partName}.arrow-up` });
      }
    });

    // Focus/blur for state tracking
    partEl.addEventListener('focus', () => {
      send({ type: `${partName}.focus` });
    });
    partEl.addEventListener('blur', () => {
      send({ type: `${partName}.blur` });
    });
  }

  function dispose() {
    disposeStateEffect();
    unsubscribe();
    machine.destroy();
    container.remove();
  }

  return {
    element: container,
    dispose,
    send,
    state: machineState,
    connectedProps,
    parts,
  };
}
