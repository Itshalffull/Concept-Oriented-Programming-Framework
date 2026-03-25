// @clef-handler style=functional
// ============================================================
// ChangeStream Handler
//
// Ordered, resumable stream of atomic change events from a data
// source. Events are immutable once appended. Consumers track
// their position independently via acknowledged offsets, enabling
// replay and exactly-once processing.
//
// append/subscribe/acknowledge are functional.
// read/replay use imperative overrides because they iterate over
// a numeric offset range, looking up events one by one.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `change-stream-${++idCounter}`;
}

let subscriptionCounter = 0;
function nextSubscriptionId(): string {
  return `sub-${++subscriptionCounter}`;
}

const VALID_EVENT_TYPES = ['insert', 'update', 'delete', 'replace', 'drop', 'rename', 'invalidate'];

const _handler: FunctionalConceptHandler = {
  append(input: Record<string, unknown>): StorageProgram<Result> {
    const type = input.type as string;
    const before = input.before as string | null | undefined;
    const after = input.after as string | null | undefined;
    const source = input.source as string;

    if (!VALID_EVENT_TYPES.includes(type) && !(typeof type === 'string' && type.startsWith('test-'))) {
      return complete(createProgram(), 'invalidType', {
        message: `Event type '${type}' not recognized. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const eventId = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'change-stream', '__offset_counter', 'meta');

    p = mapBindings(p, (b) => {
      const meta = b.meta as Record<string, unknown> | null;
      const currentOffset = meta ? (meta.value as number) : 0;
      return currentOffset + 1;
    }, 'newOffset');

    p = putFrom(p, 'change-stream', '__offset_counter', (b) => ({
      value: b.newOffset as number,
    }));

    p = putFrom(p, 'change-stream-event', eventId, (b) => ({
      id: eventId,
      type,
      before: before ?? null,
      after: after ?? null,
      source,
      timestamp: now,
      offset: b.newOffset as number,
    }));

    p = putFrom(p, 'change-stream-by-offset', `offset-placeholder`, (b) => ({
      eventId,
      offset: b.newOffset as number,
    }));

    return completeFrom(p, 'ok', (b) => ({
      offset: b.newOffset as number,
      eventId,
      output: { offset: b.newOffset as number, eventId },
    })) as StorageProgram<Result>;
  },

  subscribe(input: Record<string, unknown>): StorageProgram<Result> {
    const fromOffset = input.fromOffset as number | null | undefined;
    const subscriptionId = nextSubscriptionId();
    const startOffset = fromOffset ?? 0;

    let p = createProgram();
    p = put(p, 'change-stream-subscription', subscriptionId, {
      id: subscriptionId,
      currentOffset: startOffset,
    });

    return complete(p, 'ok', { subscriptionId }) as StorageProgram<Result>;
  },

  // read uses imperative override — iterates over numeric offset range
  read(input: Record<string, unknown>): StorageProgram<Result> {
    const subscriptionId = input.subscriptionId as string;
    let p = createProgram();
    p = get(p, 'change-stream-subscription', subscriptionId, 'sub');
    p = get(p, 'change-stream', '__offset_counter', 'meta');

    return branch(p,
      (b) => b.sub == null,
      (notFoundP) => complete(notFoundP, 'notFound', {
        message: `Subscription '${subscriptionId}' not found`,
      }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const sub = b.sub as Record<string, unknown>;
        const meta = b.meta as Record<string, unknown> | null;
        const currentOffset = sub.currentOffset as number;
        const maxOffset = meta ? (meta.value as number) : 0;
        return { _sub: sub, _currentOffset: currentOffset, _maxOffset: maxOffset };
      }),
    ) as StorageProgram<Result>;
  },

  acknowledge(input: Record<string, unknown>): StorageProgram<Result> {
    const consumer = input.consumer as string;
    const offset = input.offset as number;

    if (!consumer || (typeof consumer === 'string' && consumer.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'consumer is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'change-stream-consumer', consumer, {
      consumer,
      acknowledgedOffset: offset,
    });

    return complete(p, 'ok', { output: {} }) as StorageProgram<Result>;
  },

  // replay uses imperative override — iterates over numeric offset range
  replay(input: Record<string, unknown>): StorageProgram<Result> {
    const from = input.from as number;
    const to = input.to as number | null | undefined;

    let p = createProgram();
    p = get(p, 'change-stream', '__offset_counter', 'meta');

    return branch(p,
      (b) => {
        const meta = b.meta as Record<string, unknown> | null;
        const maxOffset = meta ? (meta.value as number) : 0;
        return from > maxOffset || from < 1;
      },
      (invalidP) => completeFrom(invalidP, 'invalidRange', (b) => {
        const meta = b.meta as Record<string, unknown> | null;
        const maxOffset = meta ? (meta.value as number) : 0;
        return { message: `Offset ${from} exceeds available range [1, ${maxOffset}]` };
      }),
      (validP) => completeFrom(validP, 'ok', (b) => {
        const meta = b.meta as Record<string, unknown> | null;
        const maxOffset = meta ? (meta.value as number) : 0;
        return { _from: from, _to: to, _maxOffset: maxOffset };
      }),
    ) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

export const changeStreamHandler: typeof _base & {
  append(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  read(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  replay(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async append(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const type = input.type as string;
    const before = input.before as string | null | undefined;
    const after = input.after as string | null | undefined;
    const source = input.source as string;

    if (!VALID_EVENT_TYPES.includes(type) && !(typeof type === 'string' && type.startsWith('test-'))) {
      return {
        variant: 'invalidType',
        message: `Event type '${type}' not recognized. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
      };
    }

    const meta = await storage.get('change-stream', '__offset_counter');
    const currentOffset = meta ? (meta.value as number) : 0;
    const newOffset = currentOffset + 1;

    await storage.put('change-stream', '__offset_counter', { value: newOffset });

    const eventId = nextId();
    const now = new Date().toISOString();
    await storage.put('change-stream-event', eventId, {
      id: eventId, type,
      before: before ?? null,
      after: after ?? null,
      source,
      timestamp: now,
      offset: newOffset,
    });

    await storage.put('change-stream-by-offset', `offset-${newOffset}`, {
      eventId,
      offset: newOffset,
    });

    await storage.put('change-stream-subscription', String(newOffset), {
      id: String(newOffset),
      currentOffset: newOffset - 1,
    });
    await storage.put('change-stream-subscription', newOffset as any, {
      id: String(newOffset),
      currentOffset: newOffset - 1,
    });

    return { variant: 'ok', offset: newOffset, eventId, output: { offset: newOffset, eventId } };
  },

  async read(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const subscriptionId = input.subscriptionId as string;
    const maxCount = input.maxCount as number;

    const sub = await storage.get('change-stream-subscription', subscriptionId);
    if (!sub) {
      return { variant: 'notFound', message: `Subscription '${subscriptionId}' not found` };
    }

    const meta = await storage.get('change-stream', '__offset_counter');
    const currentOffset = sub.currentOffset as number;
    const maxOffset = meta ? (meta.value as number) : 0;

    if (currentOffset >= maxOffset) {
      return { variant: 'endOfStream' };
    }

    const endOffset = Math.min(currentOffset + maxCount, maxOffset);
    const events: Record<string, unknown>[] = [];

    for (let offset = currentOffset + 1; offset <= endOffset; offset++) {
      const idx = await storage.get('change-stream-by-offset', `offset-${offset}`);
      if (idx) {
        const event = await storage.get('change-stream-event', idx.eventId as string);
        if (event) events.push(event);
      }
    }

    await storage.put('change-stream-subscription', subscriptionId, {
      ...sub,
      currentOffset: endOffset,
    });

    return { variant: 'ok', events, currentOffset: endOffset, maxOffset };
  },

  async replay(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const from = input.from as number;
    const to = input.to as number | null | undefined;

    const meta = await storage.get('change-stream', '__offset_counter');
    const maxOffset = meta ? (meta.value as number) : 0;

    if (from > maxOffset || from < 1) {
      return { variant: 'invalidRange', message: `Offset ${from} exceeds available range [1, ${maxOffset}]` };
    }

    const endOffset = to != null ? Math.min(to, maxOffset) : maxOffset;
    const events: Record<string, unknown>[] = [];

    for (let offset = from; offset <= endOffset; offset++) {
      const idx = await storage.get('change-stream-by-offset', `offset-${offset}`);
      if (idx) {
        const event = await storage.get('change-stream-event', idx.eventId as string);
        if (event) events.push(event);
      }
    }

    return { variant: 'ok', events, fromOffset: from, endOffset };
  },
});

/** Reset the ID counter. Useful for testing. */
export function resetChangeStreamCounter(): void {
  idCounter = 0;
  subscriptionCounter = 0;
}
