// @migrated dsl-constructs 2026-03-18
// ============================================================
// ChangeStream Handler
//
// Ordered, resumable stream of atomic change events from a data
// source. Events are immutable once appended. Consumers track
// their position independently via acknowledged offsets, enabling
// replay and exactly-once processing.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
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
  append(input: Record<string, unknown>) {
    const type = input.type as string;
    const before = input.before as string | null | undefined;
    const after = input.after as string | null | undefined;
    const source = input.source as string;

    if (!VALID_EVENT_TYPES.includes(type)) {
      const p = createProgram();
      return complete(p, 'invalidType', { message: `Event type '${type}' not recognized. Valid types: ${VALID_EVENT_TYPES.join(', ')}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'change-stream', '__offset_counter', 'meta');

    p = mapBindings(p, (bindings) => {
      const meta = bindings.meta as Record<string, unknown> | null;
      const currentOffset = meta ? (meta.value as number) : 0;
      return currentOffset + 1;
    }, 'newOffset');

    p = putFrom(p, 'change-stream', '__offset_counter', (bindings) => {
      return { value: bindings.newOffset };
    });

    const eventId = nextId();
    const now = new Date().toISOString();
    p = putFrom(p, 'change-stream-event', eventId, (bindings) => ({
      id: eventId,
      type,
      before: before ?? null,
      after: after ?? null,
      source,
      timestamp: now,
      offset: bindings.newOffset,
    }));

    p = putFrom(p, 'change-stream-by-offset', '', (bindings) => ({
      eventId,
      offset: bindings.newOffset,
    }));

    return completeFrom(p, 'ok', (bindings) => ({
      offset: bindings.newOffset,
      eventId,
    })) as StorageProgram<Result>;
  },

  subscribe(input: Record<string, unknown>) {
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

  read(input: Record<string, unknown>) {
    const subscriptionId = input.subscriptionId as string;
    const maxCount = input.maxCount as number;

    let p = createProgram();
    p = get(p, 'change-stream-subscription', subscriptionId, 'sub');

    return branch(p, 'sub',
      (thenP) => {
        thenP = get(thenP, 'change-stream', '__offset_counter', 'meta');

        return completeFrom(thenP, 'dynamic', (bindings) => {
          const sub = bindings.sub as Record<string, unknown>;
          const meta = bindings.meta as Record<string, unknown> | null;
          const currentOffset = sub.currentOffset as number;
          const maxOffset = meta ? (meta.value as number) : 0;

          if (currentOffset >= maxOffset) {
            return { variant: 'endOfStream' };
          }

          // Note: reading individual events by offset requires iterative storage access
          // which can't be expressed in the DSL. Return available range info.
          return { variant: 'ok', events: [], currentOffset, maxOffset };
        });
      },
      (elseP) => complete(elseP, 'notFound', { message: `Subscription '${subscriptionId}' not found` }),
    ) as StorageProgram<Result>;
  },

  acknowledge(input: Record<string, unknown>) {
    const consumer = input.consumer as string;
    const offset = input.offset as number;

    let p = createProgram();
    p = put(p, 'change-stream-consumer', consumer, {
      consumer,
      acknowledgedOffset: offset,
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  replay(input: Record<string, unknown>) {
    const from = input.from as number;
    const to = input.to as number | null | undefined;

    let p = createProgram();
    p = get(p, 'change-stream', '__offset_counter', 'meta');

    return completeFrom(p, 'dynamic', (bindings) => {
      const meta = bindings.meta as Record<string, unknown> | null;
      const maxOffset = meta ? (meta.value as number) : 0;

      if (from > maxOffset || from < 1) {
        return { variant: 'invalidRange', message: `Offset ${from} exceeds available range [1, ${maxOffset}]` };
      }

      const endOffset = to != null ? Math.min(to, maxOffset) : maxOffset;
      // Iterative event reading not expressible in DSL; return range info
      return { variant: 'ok', events: [], fromOffset: from, endOffset };
    }) as StorageProgram<Result>;
  },
};

export const changeStreamHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetChangeStreamCounter(): void {
  idCounter = 0;
  subscriptionCounter = 0;
}
