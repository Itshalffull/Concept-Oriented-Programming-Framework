// ============================================================
// WidgetMachine — Svelte-compatible Clef Surface component
//
// Headless state machine with Svelte rune-based reactivity
// ($state, $derived pattern). Uses on:event directive format
// for event binding. Manages state transitions, context,
// connected props (anatomy), and a11y attributes without
// rendering any UI — consumer provides render callbacks.
// ============================================================

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  Signal,
} from '../../shared/types.js';

import {
  createMachine,
  createComputed,
} from '../../shared/surface-bridge.js';

// --- Component types ---

export interface WidgetMachineProps {
  spec: WidgetSpec;
  initialContext?: Record<string, unknown>;
  /**
   * Render callback invoked whenever state changes.
   * Receives connected props for each anatomy part, the current
   * machine state, and a send function. Mirrors Svelte's
   * render-prop / slot-with-let-bindings pattern.
   */
  renderFn?: (api: WidgetRenderAPI) => void;
  'on:statechange'?: (event: { state: MachineState; previous: string }) => void;
  'on:event'?: (event: { type: string; payload: Record<string, unknown> }) => void;
}

export interface WidgetRenderAPI {
  state: MachineState;
  props: ConnectedProps;
  send: (event: { type: string; [key: string]: unknown }) => void;
  matches: (stateName: string) => boolean;
  context: Record<string, unknown>;
}

export interface WidgetMachineInstance {
  update(props: Partial<WidgetMachineProps>): void;
  destroy(): void;
  send(event: { type: string; [key: string]: unknown }): void;
  getState(): MachineState;
  getProps(): ConnectedProps;
  readonly stateSignal: Signal<MachineState>;
  readonly derivedProps: Signal<ConnectedProps>;
}

export interface WidgetMachineOptions {
  target?: HTMLElement;
  props: WidgetMachineProps;
}

// --- Component factory ---

export function createWidgetMachine(
  options: WidgetMachineOptions,
): WidgetMachineInstance {
  let { spec, initialContext, renderFn } = options.props;
  let onStateChange = options.props['on:statechange'];
  let onEvent = options.props['on:event'];

  // Create the headless machine — $state equivalent
  let machine = createMachine(spec, initialContext);

  // $derived equivalent: connected props computed from machine state
  let derivedProps = createComputed<ConnectedProps>(
    [machine.state],
    () => machine.connect(),
  );

  // Track previous state for change detection
  let previousStateName = machine.state.get().current;

  // Container element (optional — headless, but can mount data attributes)
  let container: HTMLElement | null = null;
  if (options.target) {
    container = document.createElement('div');
    container.setAttribute('data-surface-widget-machine', '');
    container.setAttribute('data-widget-name', spec.name);
    container.setAttribute('data-state', machine.state.get().current);
    options.target.appendChild(container);
  }

  // Build render API — mirrors Svelte let: bindings on slots
  function buildRenderAPI(): WidgetRenderAPI {
    const state = machine.state.get();
    return {
      state,
      props: machine.connect(),
      send: wrappedSend,
      matches: (stateName: string) => state.current === stateName,
      context: state.context,
    };
  }

  // Wrapped send that triggers events
  function wrappedSend(event: { type: string; [key: string]: unknown }): void {
    const prevState = machine.state.get().current;

    // Notify on:event
    const { type, ...rest } = event;
    onEvent?.({ type, payload: rest });

    // Execute transition
    machine.send(event);

    // Check for state change
    const newState = machine.state.get().current;
    if (newState !== prevState) {
      onStateChange?.({ state: machine.state.get(), previous: prevState });
    }
  }

  // Subscribe to state signal — $effect equivalent
  const unsubscribeState = machine.state.subscribe((state) => {
    // Update container data attributes
    if (container) {
      container.setAttribute('data-state', state.current);
      for (const [key, val] of Object.entries(state.context)) {
        if (typeof val === 'boolean') {
          if (val) {
            container.setAttribute(`data-${key}`, '');
          } else {
            container.removeAttribute(`data-${key}`);
          }
        }
      }
    }

    // Invoke render callback with new state
    if (renderFn) {
      renderFn(buildRenderAPI());
    }

    // Fire state change event if state name changed
    if (state.current !== previousStateName) {
      onStateChange?.({ state, previous: previousStateName });
      previousStateName = state.current;
    }
  });

  // Initial render
  if (renderFn) {
    renderFn(buildRenderAPI());
  }

  return {
    stateSignal: machine.state,
    derivedProps,

    send(event: { type: string; [key: string]: unknown }): void {
      wrappedSend(event);
    },

    getState(): MachineState {
      return machine.state.get();
    },

    getProps(): ConnectedProps {
      return machine.connect();
    },

    update(newProps: Partial<WidgetMachineProps>): void {
      if (newProps['on:statechange'] !== undefined) onStateChange = newProps['on:statechange'];
      if (newProps['on:event'] !== undefined) onEvent = newProps['on:event'];
      if (newProps.renderFn !== undefined) renderFn = newProps.renderFn;

      // If spec or initialContext changes, rebuild the machine
      if (newProps.spec !== undefined || newProps.initialContext !== undefined) {
        if (newProps.spec !== undefined) spec = newProps.spec;
        if (newProps.initialContext !== undefined) initialContext = newProps.initialContext;

        // Destroy old machine
        machine.destroy();

        // Create fresh machine
        machine = createMachine(spec, initialContext);
        previousStateName = machine.state.get().current;

        // Rebuild derived signal
        derivedProps = createComputed<ConnectedProps>(
          [machine.state],
          () => machine.connect(),
        );

        if (container) {
          container.setAttribute('data-widget-name', spec.name);
          container.setAttribute('data-state', machine.state.get().current);
        }

        // Re-subscribe
        machine.state.subscribe((state) => {
          if (container) {
            container.setAttribute('data-state', state.current);
          }
          if (renderFn) {
            renderFn(buildRenderAPI());
          }
        });
      }

      // Trigger re-render
      if (renderFn) {
        renderFn(buildRenderAPI());
      }
    },

    destroy(): void {
      unsubscribeState();
      machine.destroy();
      if (container) container.remove();
    },
  };
}
