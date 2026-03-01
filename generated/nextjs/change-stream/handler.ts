// ChangeStream — handler.ts
// Ordered, resumable stream of atomic change events. Events are immutable
// once appended. Consumers track position via acknowledged offsets,
// enabling replay and exactly-once processing.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ChangeStreamStorage,
  ChangeStreamAppendInput,
  ChangeStreamAppendOutput,
  ChangeStreamSubscribeInput,
  ChangeStreamSubscribeOutput,
  ChangeStreamReadInput,
  ChangeStreamReadOutput,
  ChangeStreamAcknowledgeInput,
  ChangeStreamAcknowledgeOutput,
  ChangeStreamReplayInput,
  ChangeStreamReplayOutput,
} from './types.js';

import {
  appendOk,
  appendInvalidType,
  subscribeOk,
  readOk,
  readNotFound,
  readEndOfStream,
  acknowledgeOk,
  acknowledgeNotFound,
  replayOk,
  replayInvalidRange,
} from './types.js';

export interface ChangeStreamError {
  readonly code: string;
  readonly message: string;
}

export interface ChangeStreamHandler {
  readonly append: (
    input: ChangeStreamAppendInput,
    storage: ChangeStreamStorage,
  ) => TE.TaskEither<ChangeStreamError, ChangeStreamAppendOutput>;
  readonly subscribe: (
    input: ChangeStreamSubscribeInput,
    storage: ChangeStreamStorage,
  ) => TE.TaskEither<ChangeStreamError, ChangeStreamSubscribeOutput>;
  readonly read: (
    input: ChangeStreamReadInput,
    storage: ChangeStreamStorage,
  ) => TE.TaskEither<ChangeStreamError, ChangeStreamReadOutput>;
  readonly acknowledge: (
    input: ChangeStreamAcknowledgeInput,
    storage: ChangeStreamStorage,
  ) => TE.TaskEither<ChangeStreamError, ChangeStreamAcknowledgeOutput>;
  readonly replay: (
    input: ChangeStreamReplayInput,
    storage: ChangeStreamStorage,
  ) => TE.TaskEither<ChangeStreamError, ChangeStreamReplayOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): ChangeStreamError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const generateEventId = (): string =>
  `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const generateSubscriptionId = (): string =>
  `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Recognized event types for change stream
const VALID_EVENT_TYPES: ReadonlySet<string> = new Set([
  'insert',
  'update',
  'delete',
  'replace',
  'create',
  'modify',
  'remove',
]);

// --- Implementation ---

export const changeStreamHandler: ChangeStreamHandler = {
  // Appends an event with monotonically increasing offset.
  // Validates event type against recognized types.
  append: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Validate event type
          if (!VALID_EVENT_TYPES.has(input.type)) {
            return appendInvalidType(
              `Event type "${input.type}" not recognized. Valid types: ${[...VALID_EVENT_TYPES].join(', ')}`,
            );
          }

          // Get current stream head to determine next offset
          const streamMeta = await storage.get('stream_meta', 'head');
          const currentOffset = streamMeta !== null
            ? (typeof streamMeta.offset === 'number' ? streamMeta.offset : -1)
            : -1;
          const nextOffset = currentOffset + 1;
          const eventId = generateEventId();

          // Serialize before/after Option values
          const beforeData = pipe(
            input.before,
            O.fold(
              () => null,
              (buf) => buf.toString('base64'),
            ),
          );
          const afterData = pipe(
            input.after,
            O.fold(
              () => null,
              (buf) => buf.toString('base64'),
            ),
          );

          // Store the event record keyed by offset for ordered access
          const eventRecord: Record<string, unknown> = {
            eventId,
            type: input.type,
            before: beforeData,
            after: afterData,
            source: input.source,
            timestamp: nowISO(),
            offset: nextOffset,
          };
          await storage.put('event', String(nextOffset), eventRecord);

          // Update stream head metadata
          await storage.put('stream_meta', 'head', {
            offset: nextOffset,
            lastEventId: eventId,
            updatedAt: nowISO(),
          });

          return appendOk(nextOffset, eventId);
        },
        storageError,
      ),
    ),

  // Creates a subscription from the given offset, or from stream head.
  subscribe: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const subscriptionId = generateSubscriptionId();

          const startOffset = pipe(
            input.fromOffset,
            O.getOrElse(() => {
              return 0;
            }),
          );

          await storage.put('subscription', subscriptionId, {
            subscriptionId,
            currentOffset: startOffset,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          });

          return subscribeOk(subscriptionId);
        },
        storageError,
      ),
    ),

  // Returns up to maxCount events from current subscription position.
  // Advances the subscription cursor.
  read: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('subscription', input.subscriptionId),
        storageError,
      ),
      TE.chain((subRecord) =>
        pipe(
          O.fromNullable(subRecord),
          O.fold(
            () => TE.right<ChangeStreamError, ChangeStreamReadOutput>(
              readNotFound(`Subscription ${input.subscriptionId} not found`),
            ),
            (subscription) =>
              TE.tryCatch(
                async () => {
                  const currentOffset = typeof subscription.currentOffset === 'number'
                    ? subscription.currentOffset
                    : 0;

                  // Get stream head to know the range
                  const streamMeta = await storage.get('stream_meta', 'head');
                  const headOffset = streamMeta !== null
                    ? (typeof streamMeta.offset === 'number' ? streamMeta.offset : -1)
                    : -1;

                  if (currentOffset > headOffset) {
                    return readEndOfStream();
                  }

                  // Read events from currentOffset up to maxCount
                  const events: string[] = [];
                  const endOffset = Math.min(
                    currentOffset + input.maxCount - 1,
                    headOffset,
                  );

                  for (let i = currentOffset; i <= endOffset; i++) {
                    const eventRecord = await storage.get('event', String(i));
                    if (eventRecord !== null) {
                      events.push(
                        typeof eventRecord.eventId === 'string'
                          ? eventRecord.eventId
                          : String(i),
                      );
                    }
                  }

                  if (events.length === 0) {
                    return readEndOfStream();
                  }

                  // Advance subscription cursor
                  await storage.put('subscription', input.subscriptionId, {
                    ...subscription,
                    currentOffset: endOffset + 1,
                    updatedAt: nowISO(),
                  });

                  return readOk(events);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Records the consumer's acknowledged offset.
  acknowledge: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check consumer exists
          const consumerRecord = await storage.get('consumer', input.consumer);

          if (consumerRecord === null) {
            // Auto-register consumer on first acknowledgment
            await storage.put('consumer', input.consumer, {
              consumer: input.consumer,
              acknowledgedOffset: input.offset,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            });
            return acknowledgeOk();
          }

          // Update acknowledged offset (must be monotonically increasing)
          const currentAck = typeof consumerRecord.acknowledgedOffset === 'number'
            ? consumerRecord.acknowledgedOffset
            : -1;

          const newOffset = Math.max(currentAck, input.offset);
          await storage.put('consumer', input.consumer, {
            ...consumerRecord,
            acknowledgedOffset: newOffset,
            updatedAt: nowISO(),
          });

          return acknowledgeOk();
        },
        storageError,
      ),
    ),

  // Returns all events in the offset range [from, to].
  // Immutable replay -- always returns the same events for the same range.
  replay: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Validate range
          const streamMeta = await storage.get('stream_meta', 'head');
          const headOffset = streamMeta !== null
            ? (typeof streamMeta.offset === 'number' ? streamMeta.offset : -1)
            : -1;

          if (input.from > headOffset) {
            return replayInvalidRange(
              `From offset ${input.from} exceeds stream head ${headOffset}`,
            );
          }

          const toOffset = pipe(
            input.to,
            O.getOrElse(() => headOffset),
          );

          if (input.from > toOffset) {
            return replayInvalidRange(
              `From offset ${input.from} exceeds to offset ${toOffset}`,
            );
          }

          // Collect events in range
          const events: string[] = [];
          for (let i = input.from; i <= toOffset; i++) {
            const eventRecord = await storage.get('event', String(i));
            if (eventRecord !== null) {
              events.push(
                typeof eventRecord.eventId === 'string'
                  ? eventRecord.eventId
                  : String(i),
              );
            }
          }

          return replayOk(events);
        },
        storageError,
      ),
    ),
};
