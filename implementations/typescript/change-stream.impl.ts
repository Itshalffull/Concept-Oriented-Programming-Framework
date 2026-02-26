// ============================================================
// ChangeStream Handler
//
// Ordered, resumable stream of atomic change events from a data
// source. Events are immutable once appended. Consumers track
// their position independently via acknowledged offsets, enabling
// replay and exactly-once processing.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `change-stream-${++idCounter}`;
}

let subscriptionCounter = 0;
function nextSubscriptionId(): string {
  return `sub-${++subscriptionCounter}`;
}

const VALID_EVENT_TYPES = ['insert', 'update', 'delete', 'replace', 'drop', 'rename', 'invalidate'];

export const changeStreamHandler: ConceptHandler = {
  async append(input: Record<string, unknown>, storage: ConceptStorage) {
    const type = input.type as string;
    const before = input.before as string | null | undefined;
    const after = input.after as string | null | undefined;
    const source = input.source as string;

    if (!VALID_EVENT_TYPES.includes(type)) {
      return { variant: 'invalidType', message: `Event type '${type}' not recognized. Valid types: ${VALID_EVENT_TYPES.join(', ')}` };
    }

    // Get the current offset counter
    const meta = await storage.get('change-stream', '__offset_counter');
    const currentOffset = meta ? (meta.value as number) : 0;
    const newOffset = currentOffset + 1;

    // Update offset counter
    await storage.put('change-stream', '__offset_counter', { value: newOffset });

    // Store the event
    const eventId = nextId();
    const now = new Date().toISOString();
    await storage.put('change-stream-event', eventId, {
      id: eventId,
      type,
      before: before ?? null,
      after: after ?? null,
      source,
      timestamp: now,
      offset: newOffset,
    });

    // Also store by offset for efficient replay
    await storage.put('change-stream-by-offset', String(newOffset), {
      eventId,
      offset: newOffset,
    });

    return { variant: 'ok', offset: newOffset, eventId };
  },

  async subscribe(input: Record<string, unknown>, storage: ConceptStorage) {
    const fromOffset = input.fromOffset as number | null | undefined;

    const subscriptionId = nextSubscriptionId();
    const startOffset = fromOffset ?? 0;

    await storage.put('change-stream-subscription', subscriptionId, {
      id: subscriptionId,
      currentOffset: startOffset,
    });

    return { variant: 'ok', subscriptionId };
  },

  async read(input: Record<string, unknown>, storage: ConceptStorage) {
    const subscriptionId = input.subscriptionId as string;
    const maxCount = input.maxCount as number;

    const sub = await storage.get('change-stream-subscription', subscriptionId);
    if (!sub) {
      return { variant: 'notFound', message: `Subscription '${subscriptionId}' not found` };
    }

    const currentOffset = sub.currentOffset as number;
    const meta = await storage.get('change-stream', '__offset_counter');
    const maxOffset = meta ? (meta.value as number) : 0;

    if (currentOffset >= maxOffset) {
      return { variant: 'endOfStream' };
    }

    // Read events from currentOffset+1 up to maxCount
    const events: Record<string, unknown>[] = [];
    for (let offset = currentOffset + 1; offset <= Math.min(currentOffset + maxCount, maxOffset); offset++) {
      const entry = await storage.get('change-stream-by-offset', String(offset));
      if (entry) {
        const event = await storage.get('change-stream-event', entry.eventId as string);
        if (event) {
          events.push(event);
        }
      }
    }

    if (events.length === 0) {
      return { variant: 'endOfStream' };
    }

    // Advance subscription position
    const newOffset = currentOffset + events.length;
    await storage.put('change-stream-subscription', subscriptionId, {
      ...sub,
      currentOffset: newOffset,
    });

    return { variant: 'ok', events };
  },

  async acknowledge(input: Record<string, unknown>, storage: ConceptStorage) {
    const consumer = input.consumer as string;
    const offset = input.offset as number;

    // Store acknowledgment per consumer
    await storage.put('change-stream-consumer', consumer, {
      consumer,
      acknowledgedOffset: offset,
    });

    return { variant: 'ok' };
  },

  async replay(input: Record<string, unknown>, storage: ConceptStorage) {
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
      const entry = await storage.get('change-stream-by-offset', String(offset));
      if (entry) {
        const event = await storage.get('change-stream-event', entry.eventId as string);
        if (event) {
          events.push(event);
        }
      }
    }

    return { variant: 'ok', events };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetChangeStreamCounter(): void {
  idCounter = 0;
  subscriptionCounter = 0;
}
