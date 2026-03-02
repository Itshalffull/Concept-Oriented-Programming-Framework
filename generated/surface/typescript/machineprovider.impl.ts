// MachineProvider Concept Implementation
// Manages state machine instances with spawn, event dispatch, inter-machine connections, and teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'machineprovider';
const META_KEY = '__meta__';
const MACHINE_PREFIX = 'machine:';
const CONNECTION_PREFIX = 'conn:';

export const machineproviderHandler: ConceptHandler = {
  /**
   * initialize(config) -> ok(provider, pluginRef) | configError(message)
   * Idempotent initialization of the machine provider.
   */
  async initialize(input, storage) {
    const config = input.config as Record<string, unknown>;

    if (!config || typeof config !== 'object') {
      return { variant: 'configError', message: 'Config must be a non-null object' };
    }

    const existing = await storage.get(RELATION, META_KEY);
    if (existing) {
      return {
        variant: 'ok',
        provider: existing.provider as string,
        pluginRef: existing.pluginRef as string,
      };
    }

    const provider = `machineprovider-${Date.now()}`;
    const pluginRef = 'surface-provider:machine';

    await storage.put(RELATION, META_KEY, {
      provider,
      pluginRef,
      config: JSON.stringify(config),
      connectionCounter: 0,
    });

    return { variant: 'ok', provider, pluginRef };
  },

  /**
   * spawn(machineId, definition, initialState, context?) -> ok(machineId, state) | duplicate(message) | invalid(message)
   * Creates a new state machine instance with an initial state and optional context.
   */
  async spawn(input, storage) {
    const machineId = input.machineId as string;
    const definition = input.definition as string;
    const initialState = input.initialState as string;
    const context = (input.context as Record<string, unknown>) ?? {};

    if (!machineId || !definition || !initialState) {
      return { variant: 'invalid', message: 'machineId, definition, and initialState are required' };
    }

    const key = `${MACHINE_PREFIX}${machineId}`;
    const existing = await storage.get(RELATION, key);
    if (existing) {
      return { variant: 'duplicate', message: `Machine "${machineId}" already exists` };
    }

    await storage.put(RELATION, key, {
      machineId,
      definition,
      currentState: initialState,
      previousState: null,
      context: JSON.stringify(context),
      history: JSON.stringify([initialState]),
    });

    return { variant: 'ok', machineId, state: initialState };
  },

  /**
   * send(machineId, event, payload?) -> ok(machineId, previousState, currentState) | notfound(message) | rejected(message)
   * Dispatches an event to a machine, transitioning its state.
   */
  async send(input, storage) {
    const machineId = input.machineId as string;
    const event = input.event as string;
    const payload = (input.payload as Record<string, unknown>) ?? {};

    const key = `${MACHINE_PREFIX}${machineId}`;
    const machine = await storage.get(RELATION, key);
    if (!machine) {
      return { variant: 'notfound', message: `Machine "${machineId}" does not exist` };
    }

    const currentState = machine.currentState as string;

    // Simple transition: event name becomes the new state unless it starts with "__"
    // which indicates an internal/rejected event
    if (event.startsWith('__')) {
      return {
        variant: 'rejected',
        message: `Event "${event}" is not allowed in state "${currentState}"`,
      };
    }

    const newState = event;
    const history = JSON.parse(machine.history as string) as string[];
    history.push(newState);

    const updatedContext = { ...JSON.parse(machine.context as string), ...payload };

    await storage.put(RELATION, key, {
      ...machine,
      previousState: currentState,
      currentState: newState,
      context: JSON.stringify(updatedContext),
      history: JSON.stringify(history),
    });

    return { variant: 'ok', machineId, previousState: currentState, currentState: newState };
  },

  /**
   * connect(sourceMachineId, targetMachineId, event) -> ok(connectionId) | notfound(message) | duplicate(message)
   * Creates a connection between two machines that forwards events.
   */
  async connect(input, storage) {
    const sourceMachineId = input.sourceMachineId as string;
    const targetMachineId = input.targetMachineId as string;
    const event = input.event as string;

    // Verify source exists
    const sourceKey = `${MACHINE_PREFIX}${sourceMachineId}`;
    const source = await storage.get(RELATION, sourceKey);
    if (!source) {
      return { variant: 'notfound', message: `Source machine "${sourceMachineId}" does not exist` };
    }

    // Verify target exists
    const targetKey = `${MACHINE_PREFIX}${targetMachineId}`;
    const target = await storage.get(RELATION, targetKey);
    if (!target) {
      return { variant: 'notfound', message: `Target machine "${targetMachineId}" does not exist` };
    }

    // Check for duplicate connection
    const connKey = `${CONNECTION_PREFIX}${sourceMachineId}:${targetMachineId}:${event}`;
    const existingConn = await storage.get(RELATION, connKey);
    if (existingConn) {
      return {
        variant: 'duplicate',
        message: `Connection from "${sourceMachineId}" to "${targetMachineId}" on "${event}" already exists`,
      };
    }

    // Generate connection id
    const meta = await storage.get(RELATION, META_KEY);
    const counter = ((meta?.connectionCounter as number) ?? 0) + 1;
    const connectionId = `conn-${counter}`;

    if (meta) {
      await storage.put(RELATION, META_KEY, { ...meta, connectionCounter: counter });
    }

    await storage.put(RELATION, connKey, {
      connectionId,
      sourceMachineId,
      targetMachineId,
      event,
    });

    return { variant: 'ok', connectionId };
  },

  /**
   * destroy(machineId) -> ok(machineId) | notfound(message)
   * Removes a machine instance and its connections.
   */
  async destroy(input, storage) {
    const machineId = input.machineId as string;
    const key = `${MACHINE_PREFIX}${machineId}`;

    const existing = await storage.get(RELATION, key);
    if (!existing) {
      return { variant: 'notfound', message: `Machine "${machineId}" does not exist` };
    }

    // Remove the machine
    await storage.del(RELATION, key);

    // Remove all connections involving this machine
    const allEntries = await storage.find(RELATION);
    for (const entry of allEntries) {
      const entryKey = entry._key as string;
      if (entryKey.startsWith(CONNECTION_PREFIX)) {
        if (
          entry.sourceMachineId === machineId ||
          entry.targetMachineId === machineId
        ) {
          await storage.del(RELATION, entryKey);
        }
      }
    }

    return { variant: 'ok', machineId };
  },
};
