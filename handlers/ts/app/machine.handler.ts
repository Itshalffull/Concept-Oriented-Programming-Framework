// Machine Concept Implementation
// Manages stateful UI component lifecycles through finite state machine transitions.
import type { ConceptHandler } from '@clef/runtime';

let machineCounter = 0;

export const machineHandler: ConceptHandler = {
  async spawn(input, storage) {
    const machine = input.machine as string;
    const widget = input.widget as string;
    const context = input.context as string;

    // Look up the widget in storage
    const widgetRecord = await storage.get('widget', widget);
    if (!widgetRecord) {
      return { variant: 'notfound', message: `Widget "${widget}" not found` };
    }

    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'invalid', message: 'Context must be valid JSON' };
    }

    machineCounter++;

    await storage.put('machine', machine, {
      machine,
      currentState: 'idle',
      context: JSON.stringify(parsedContext),
      component: widget,
      status: 'running',
      transitions: JSON.stringify({
        idle: { start: 'active', destroy: 'terminated' },
        active: { pause: 'paused', error: 'errored', complete: 'completed', destroy: 'terminated' },
        paused: { resume: 'active', destroy: 'terminated' },
        errored: { retry: 'active', destroy: 'terminated' },
        completed: { reset: 'idle', destroy: 'terminated' },
        terminated: {},
      }),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async send(input, storage) {
    const machine = input.machine as string;
    const event = input.event as string;

    const existing = await storage.get('machine', machine);
    if (!existing) {
      return { variant: 'invalid', message: `Machine "${machine}" not found` };
    }

    const currentState = existing.currentState as string;
    const transitions = JSON.parse((existing.transitions as string) || '{}');

    // Parse event: may include guard conditions as "event:guard"
    const [eventName, guard] = event.split(':');

    const stateTransitions = transitions[currentState];
    if (!stateTransitions || !stateTransitions[eventName]) {
      return {
        variant: 'invalid',
        message: `No transition for event "${eventName}" from state "${currentState}"`,
      };
    }

    // If a guard is specified, check it against context
    if (guard) {
      const context = JSON.parse((existing.context as string) || '{}');
      if (context[guard] === false || context[guard] === undefined) {
        return {
          variant: 'guarded',
          guard,
          message: `Transition guarded by "${guard}" which evaluated to false`,
        };
      }
    }

    const newState = stateTransitions[eventName] as string;
    const newStatus = newState === 'terminated' ? 'terminated' : 'running';

    await storage.put('machine', machine, {
      ...existing,
      currentState: newState,
      status: newStatus,
    });

    return { variant: 'ok', state: newState };
  },

  async connect(input, storage) {
    const machine = input.machine as string;

    const existing = await storage.get('machine', machine);
    if (!existing) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    const context = JSON.parse((existing.context as string) || '{}');
    const props = {
      currentState: existing.currentState,
      status: existing.status,
      component: existing.component,
      ...context,
    };

    return { variant: 'ok', props: JSON.stringify(props) };
  },

  async destroy(input, storage) {
    const machine = input.machine as string;

    const existing = await storage.get('machine', machine);
    if (!existing) {
      return { variant: 'notfound', message: `Machine "${machine}" not found` };
    }

    await storage.put('machine', machine, {
      ...existing,
      currentState: 'terminated',
      status: 'terminated',
    });

    return { variant: 'ok' };
  },
};
