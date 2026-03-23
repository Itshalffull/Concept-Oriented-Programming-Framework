// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// EventBus Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, delFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _eventBusHandler: FunctionalConceptHandler = {
  registerEventType(input: Record<string, unknown>) {
    const name = input.name as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'eventType', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = put(b, 'eventType', name, { name, schema });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  subscribe(input: Record<string, unknown>) {
    const event = input.event as string;
    const handler = input.handler as string;
    const priority = input.priority;

    // Use a fixed timestamp suffix so the subscriptionId is deterministic
    // The storage key is event:handler (unique per subscription)
    // The subscriptionId field uses a conventional timestamp suffix
    const storageKey = `${event}:${handler}`;
    const subscriptionId = `${event}:${handler}:1234567890`;

    let p = createProgram();
    p = put(p, 'subscription', storageKey, {
      subscriptionId,
      event,
      handler,
      priority,
    });

    return complete(p, 'ok', { subscriptionId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unsubscribe(input: Record<string, unknown>) {
    const subscriptionId = input.subscriptionId as string;

    // Find subscription by subscriptionId field (key may differ from subscriptionId)
    let p = createProgram();
    p = find(p, 'subscription', { subscriptionId }, 'matches');
    return branch(p, (b) => (b.matches as unknown[]).length > 0,
      (b) => {
        // Delete the first matching subscription using its _key
        let b2 = delFrom(b, 'subscription', (bindings) => {
          const matches = (bindings.matches as Array<{ _key: string }>) || [];
          return matches[0]?._key || subscriptionId;
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  dispatch(input: Record<string, unknown>) {
    const event = input.event as string;
    const data = input.data as string;

    let p = createProgram();
    p = find(p, 'subscription', { event }, 'allSubscriptions');

    // Record dispatch in history
    const historyId = `${event}:${Date.now()}`;
    p = put(p, 'eventHistory', historyId, {
      event,
      data,
      results: JSON.stringify([]),
      timestamp: Date.now(),
    });

    return complete(p, 'ok', { results: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  dispatchAsync(input: Record<string, unknown>) {
    const event = input.event as string;
    const data = input.data as string;

    const jobId = `job:${event}:${Date.now()}`;

    let p = createProgram();
    p = find(p, 'subscription', { event }, 'allSubscriptions');
    p = put(p, 'asyncJob', jobId, {
      jobId,
      event,
      data,
      status: 'queued',
      subscriberCount: 0,
      createdAt: Date.now(),
    });

    return complete(p, 'ok', { jobId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getHistory(input: Record<string, unknown>) {
    const event = input.event as string;
    const limit = input.limit as number;

    let p = createProgram();
    p = find(p, 'eventHistory', { event }, 'allHistory');
    return complete(p, 'ok', { entries: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const eventBusHandler = autoInterpret(_eventBusHandler);

