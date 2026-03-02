// MachineProvider Concept Implementation [P]
// Provider lifecycle for widget state machine execution with machine pool management.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:machine';

export const machineProviderHandler: ConceptHandler = {
  async initialize(input, storage) {
    const config = input.config as string;

    const existing = await storage.find('machine-provider', { pluginRef: PLUGIN_REF });
    if (existing.length > 0) {
      return { variant: 'ok', provider: (existing[0] as Record<string, unknown>).id as string, pluginRef: PLUGIN_REF };
    }

    try {
      JSON.parse(config || '{}');
    } catch {
      return { variant: 'configError', message: 'Invalid JSON in config' };
    }

    const id = nextId('mp');

    await storage.put('machine-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      machines: '{}',
      activeCount: 0,
    });

    await storage.put('plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'machine',
      providerRef: id,
      instanceId: id,
    });

    return { variant: 'ok', provider: id, pluginRef: PLUGIN_REF };
  },

  async spawn(input, storage) {
    const provider = input.provider as string;
    const widget = input.widget as string;
    const context = input.context as string;

    // Verify widget is registered
    const widgetRecord = await storage.get('widget', widget);
    if (!widgetRecord) {
      return { variant: 'notfound', message: `Widget "${widget}" not registered` };
    }

    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'invalid', message: 'Context must be valid JSON' };
    }

    const machineId = nextId('machine');

    // Determine initial state from widget spec
    const spec = widgetRecord as Record<string, unknown>;
    const initialState = (spec.initialState as string) || 'idle';

    await storage.put('machine', machineId, {
      id: machineId,
      provider,
      widget,
      currentState: initialState,
      context: JSON.stringify(parsedContext),
      status: 'running',
    });

    // Update provider's machine pool
    const instance = await storage.get('machine-provider', provider);
    if (instance) {
      const machines = JSON.parse((instance.machines as string) || '{}');
      machines[machineId] = { widget, state: initialState };
      const activeCount = (instance.activeCount as number) + 1;
      await storage.put('machine-provider', provider, {
        ...instance,
        machines: JSON.stringify(machines),
        activeCount,
      });
    }

    return { variant: 'ok', provider, machine: machineId };
  },

  async send(input, storage) {
    const provider = input.provider as string;
    const machine = input.machine as string;
    const event = input.event as string;

    const machineRecord = await storage.get('machine', machine);
    if (!machineRecord) {
      return { variant: 'invalid', message: `Machine "${machine}" not found` };
    }

    let parsedEvent: Record<string, unknown>;
    try {
      parsedEvent = JSON.parse(event);
    } catch {
      parsedEvent = { type: event };
    }

    const currentState = machineRecord.currentState as string;
    const eventType = (parsedEvent.type as string) || event;

    // Simple state transition: convention-based next state
    const nextState = resolveTransition(currentState, eventType);
    if (!nextState) {
      return { variant: 'invalid', message: `Event "${eventType}" not handled in state "${currentState}"` };
    }

    await storage.put('machine', machine, {
      ...machineRecord,
      currentState: nextState,
    });

    // Update provider pool
    const instance = await storage.get('machine-provider', provider);
    if (instance) {
      const machines = JSON.parse((instance.machines as string) || '{}');
      if (machines[machine]) {
        machines[machine].state = nextState;
        await storage.put('machine-provider', provider, {
          ...instance,
          machines: JSON.stringify(machines),
        });
      }
    }

    return { variant: 'ok', provider, machine, state: nextState };
  },

  async connect(input, storage) {
    const provider = input.provider as string;
    const machine = input.machine as string;

    const machineRecord = await storage.get('machine', machine);
    if (!machineRecord) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    const currentState = machineRecord.currentState as string;
    const context = machineRecord.context as string;

    // Generate framework-neutral props from state + context
    const props = JSON.stringify({
      'data-state': currentState,
      'aria-expanded': currentState === 'open' ? 'true' : undefined,
      'aria-hidden': currentState === 'closed' ? 'true' : undefined,
    });

    return { variant: 'ok', provider, machine, props };
  },

  async destroy(input, storage) {
    const provider = input.provider as string;
    const machine = input.machine as string;

    const machineRecord = await storage.get('machine', machine);
    if (!machineRecord) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    await storage.put('machine', machine, {
      ...machineRecord,
      status: 'destroyed',
    });

    // Update provider pool
    const instance = await storage.get('machine-provider', provider);
    if (instance) {
      const machines = JSON.parse((instance.machines as string) || '{}');
      delete machines[machine];
      const activeCount = Math.max(0, (instance.activeCount as number) - 1);
      await storage.put('machine-provider', provider, {
        ...instance,
        machines: JSON.stringify(machines),
        activeCount,
      });
    }

    return { variant: 'ok', provider, machine };
  },
};

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
