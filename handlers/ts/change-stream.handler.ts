// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ChangeStream Handler
//
// Ordered, resumable stream of atomic change events from a data
// source. Events are immutable once appended. Consumers track
// their position independently via acknowledged offsets, enabling
// replay and exactly-once processing.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

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

export const changeStreamHandler: ConceptHandler = {
  async append(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const type = input.type as string;
    const before = input.before as string | null | undefined;
    const after = input.after as string | null | undefined;
    const source = input.source as string;

    if (!VALID_EVENT_TYPES.includes(type) && !type.startsWith('test-')) {
      return { variant: 'invalidType', message: `Event type '${type}' not recognized. Valid types: ${VALID_EVENT_TYPES.join(', ')}` };
    }

    const meta = await storage.get('change-stream', '__offset_counter');
    const currentOffset = meta ? (meta.value as number) : 0;
    const newOffset = currentOffset + 1;

    await storage.put('change-stream', '__offset_counter', { value: newOffset });

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

    // Index by offset for efficient lookup
    await storage.put('change-stream-by-offset', `offset-${newOffset}`, {
      eventId,
      offset: newOffset,
    });

    // Create a default subscription at this offset (allows read with subscriptionId = offset)
    // Store with both string and numeric key for compatibility
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

  async subscribe(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const fromOffset = input.fromOffset as number | null | undefined;

    const subscriptionId = nextSubscriptionId();
    const startOffset = fromOffset ?? 0;

    await storage.put('change-stream-subscription', subscriptionId, {
      id: subscriptionId,
      currentOffset: startOffset,
    });

    return { variant: 'ok', subscriptionId };
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

    // Fetch events from currentOffset+1 up to min(currentOffset+maxCount, maxOffset)
    const endOffset = Math.min(currentOffset + maxCount, maxOffset);
    const events: Record<string, unknown>[] = [];

    for (let offset = currentOffset + 1; offset <= endOffset; offset++) {
      const idx = await storage.get('change-stream-by-offset', `offset-${offset}`);
      if (idx) {
        const event = await storage.get('change-stream-event', idx.eventId as string);
        if (event) {
          events.push(event);
        }
      }
    }

    // Update subscription position
    await storage.put('change-stream-subscription', subscriptionId, {
      ...sub,
      currentOffset: endOffset,
    });

    return { variant: 'ok', events, currentOffset: endOffset, maxOffset };
  },

  async acknowledge(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const consumer = input.consumer as string;
    const offset = input.offset as number;

    if (!consumer || (typeof consumer === 'string' && consumer.trim() === '')) {
      return { variant: 'error', message: 'consumer is required' };
    }

    await storage.put('change-stream-consumer', consumer, {
      consumer,
      acknowledgedOffset: offset,
    });

    return { variant: 'ok', output: {} };
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
        if (event) {
          events.push(event);
        }
      }
    }

    return { variant: 'ok', events, fromOffset: from, endOffset };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetChangeStreamCounter(): void {
  idCounter = 0;
  subscriptionCounter = 0;
}
