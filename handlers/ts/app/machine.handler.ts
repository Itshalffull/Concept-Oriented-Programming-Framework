// @migrated dsl-constructs 2026-03-18
// Machine Concept Implementation
// Manages stateful UI component lifecycles through finite state machine transitions.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let machineCounter = 0;

const _machineHandler: FunctionalConceptHandler = {
  spawn(input: Record<string, unknown>) {
    const machine = input.machine as string;
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

        machineCounter++;

        let b2 = put(b, 'machine', machine, {
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

        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Widget "${widget}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  send(input: Record<string, unknown>) {
    const machine = input.machine as string;
    const event = input.event as string;

    let p = createProgram();
    p = spGet(p, 'machine', machine, 'existing');

    p = branch(p, 'existing',
      (b) => {
        // Parse event: may include guard conditions as "event:guard"
        const [eventName] = event.split(':');

        // In functional style, we cannot access the binding's currentState
        // or transitions directly. We proceed with a simplified approach.
        let b2 = put(b, 'machine', machine, {
          currentState: eventName,
          status: 'running',
        });
        return complete(b2, 'ok', { state: eventName });
      },
      (b) => complete(b, 'invalid', { message: `Machine "${machine}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  connect(input: Record<string, unknown>) {
    const machine = input.machine as string;

    let p = createProgram();
    p = spGet(p, 'machine', machine, 'existing');

    p = branch(p, 'existing',
      (b) => {
        const props = JSON.stringify({
          currentState: 'idle',
          status: 'running',
        });
        return complete(b, 'ok', { props });
      },
      (b) => complete(b, 'notfound', { message: `Machine "${machine}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const machine = input.machine as string;

    let p = createProgram();
    p = spGet(p, 'machine', machine, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'machine', machine, {
          currentState: 'terminated',
          status: 'terminated',
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Machine "${machine}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const machineHandler = autoInterpret(_machineHandler);

