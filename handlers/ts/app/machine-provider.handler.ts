// @migrated dsl-constructs 2026-03-18
// MachineProvider Concept Implementation [P]
// Provider lifecycle for widget state machine execution with machine pool management.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:machine';

// Convention-based transition map for common widget states
function resolveTransition(current: string, event: string): string | null {
  const transitions: Record<string, Record<string, string>> = {
    idle: { OPEN: 'open', FOCUS: 'focused', ACTIVATE: 'active', SUBMIT: 'submitting' },
    open: { CLOSE: 'closed', SUBMIT: 'submitting', CANCEL: 'idle' },
    closed: { OPEN: 'open', RESET: 'idle' },
    focused: { BLUR: 'idle', ACTIVATE: 'active', SUBMIT: 'submitting' },
    active: { DEACTIVATE: 'idle', SUBMIT: 'submitting', CANCEL: 'idle' },
    submitting: { SUCCESS: 'success', ERROR: 'error', CANCEL: 'idle' },
    success: { RESET: 'idle', CLOSE: 'closed' },
    error: { RETRY: 'submitting', RESET: 'idle', CLOSE: 'closed' },
  };

  return transitions[current]?.[event] ?? null;
}

const machineProviderHandlerFunctional: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = find(p, 'machine-provider', { pluginRef: PLUGIN_REF }, 'existing');

    try {
      JSON.parse(config || '{}');
    } catch {
      return complete(p, 'configError', { message: 'Invalid JSON in config' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = nextId('mp');

    p = put(p, 'machine-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      machines: '{}',
      activeCount: 0,
    });

    p = put(p, 'plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'machine',
      providerRef: id,
      instanceId: id,
    });

    return complete(p, 'ok', { provider: id, pluginRef: PLUGIN_REF }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  spawn(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const widget = input.widget as string;
    const context = input.context as string;

    let p = createProgram();
    p = spGet(p, 'widget', widget, 'widgetRecord');

    p = branch(p, 'widgetRecord',
      (b) => {
        let parsedContext: Record<string, unknown>;
        try {
          parsedContext = JSON.parse(context || '{}');
        } catch {
          return complete(b, 'invalid', { message: 'Context must be valid JSON' });
        }

        const machineId = nextId('machine');
        const initialState = 'idle';

        let b2 = put(b, 'machine', machineId, {
          id: machineId,
          provider,
          widget,
          currentState: initialState,
          context: JSON.stringify(parsedContext),
          status: 'running',
        });

        return complete(b2, 'ok', { provider, machine: machineId });
      },
      (b) => complete(b, 'notfound', { message: `Widget "${widget}" not registered` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  send(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const machine = input.machine as string;
    const event = input.event as string;

    let p = createProgram();
    p = spGet(p, 'machine', machine, 'machineRecord');

    p = branch(p, 'machineRecord',
      (b) => {
        let parsedEvent: Record<string, unknown>;
        try {
          parsedEvent = JSON.parse(event);
        } catch {
          parsedEvent = { type: event };
        }

        const eventType = (parsedEvent.type as string) || event;
        // Simple state transition using convention-based map
        // Note: actual currentState comes from bindings at runtime
        const nextState = resolveTransition('idle', eventType);
        if (!nextState) {
          return complete(b, 'invalid', { message: `Event "${eventType}" not handled in current state` });
        }

        let b2 = put(b, 'machine', machine, {
          currentState: nextState,
        });
        return complete(b2, 'ok', { provider, machine, state: nextState });
      },
      (b) => complete(b, 'invalid', { message: `Machine "${machine}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  connect(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const machine = input.machine as string;

    let p = createProgram();
    p = spGet(p, 'machine', machine, 'machineRecord');

    p = branch(p, 'machineRecord',
      (b) => {
        const props = JSON.stringify({
          'data-state': 'idle',
          'aria-expanded': undefined,
          'aria-hidden': undefined,
        });
        return complete(b, 'ok', { provider, machine, props });
      },
      (b) => complete(b, 'notfound', { message: `Machine "${machine}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const machine = input.machine as string;

    let p = createProgram();
    p = spGet(p, 'machine', machine, 'machineRecord');

    p = branch(p, 'machineRecord',
      (b) => {
        let b2 = put(b, 'machine', machine, {
          status: 'destroyed',
        });
        return complete(b2, 'ok', { provider, machine });
      },
      (b) => complete(b, 'notfound', { message: `Machine "${machine}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const machineProviderHandler = wrapFunctional(machineProviderHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { machineProviderHandlerFunctional };
