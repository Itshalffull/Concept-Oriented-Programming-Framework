// ============================================================
// Machine Concept Implementation
//
// Finite state machine runtime. Spawns machine instances bound
// to components, processes events to transition state, and
// generates connection props from current state.
// Relation: 'machine' keyed by machine (M).
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

export const machineHandler: ConceptHandler = {
  async spawn(input, storage) {
    const machine = input.machine as string;
    const component = input.component as string;
    const context = input.context as string;

    // Parse context to extract initial state information
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context) as Record<string, unknown>;
    } catch {
      return { variant: 'notfound', message: `Invalid context JSON for machine "${machine}"` };
    }

    const initialState = (parsedContext.initial as string) || 'idle';

    await storage.put('machine', machine, {
      machine,
      component,
      context,
      current: initialState,
      status: 'running',
    });

    return { variant: 'ok', machine };
  },

  async send(input, storage) {
    const machine = input.machine as string;
    const event = input.event as string;

    const record = await storage.get('machine', machine);
    if (!record) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    const status = record.status as string;
    if (status !== 'running') {
      return { variant: 'invalid', message: `Machine "${machine}" is not running (status: ${status})` };
    }

    // Parse the context to look up transitions
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(record.context as string) as Record<string, unknown>;
    } catch {
      return { variant: 'invalid', message: `Machine "${machine}" has invalid context` };
    }

    // Resolve next state from transitions map or stay in current state
    const currentState = record.current as string;
    const states = parsedContext.states as Record<string, Record<string, unknown>> | undefined;
    let nextState = currentState;

    if (states && states[currentState]) {
      const stateConfig = states[currentState];
      const on = stateConfig.on as Record<string, string> | undefined;
      if (on && on[event]) {
        nextState = on[event];
      }
    }

    await storage.put('machine', machine, {
      ...record,
      current: nextState,
    });

    return { variant: 'ok', machine, state: nextState };
  },

  async connect(input, storage) {
    const machine = input.machine as string;

    const record = await storage.get('machine', machine);
    if (!record) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    // Generate props JSON from current machine state
    const props = JSON.stringify({
      state: record.current as string,
      status: record.status as string,
      component: record.component as string,
    });

    return { variant: 'ok', machine, props };
  },

  async destroy(input, storage) {
    const machine = input.machine as string;

    const record = await storage.get('machine', machine);
    if (!record) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    await storage.del('machine', machine);

    return { variant: 'ok', machine };
  },
};
