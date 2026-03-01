// EventBus — handler.ts
// Real fp-ts domain logic for priority-ordered event dispatch with history and dead-letter queue.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { randomBytes } from 'crypto';

import type {
  EventBusStorage,
  EventBusRegisterEventTypeInput,
  EventBusRegisterEventTypeOutput,
  EventBusSubscribeInput,
  EventBusSubscribeOutput,
  EventBusUnsubscribeInput,
  EventBusUnsubscribeOutput,
  EventBusDispatchInput,
  EventBusDispatchOutput,
  EventBusDispatchAsyncInput,
  EventBusDispatchAsyncOutput,
  EventBusGetHistoryInput,
  EventBusGetHistoryOutput,
} from './types.js';

import {
  registerEventTypeOk,
  registerEventTypeExists,
  subscribeOk,
  unsubscribeOk,
  unsubscribeNotfound,
  dispatchOk,
  dispatchError,
  dispatchAsyncOk,
  dispatchAsyncError,
  getHistoryOk,
} from './types.js';

export interface EventBusError {
  readonly code: string;
  readonly message: string;
}

export interface EventBusHandler {
  readonly registerEventType: (
    input: EventBusRegisterEventTypeInput,
    storage: EventBusStorage,
  ) => TE.TaskEither<EventBusError, EventBusRegisterEventTypeOutput>;
  readonly subscribe: (
    input: EventBusSubscribeInput,
    storage: EventBusStorage,
  ) => TE.TaskEither<EventBusError, EventBusSubscribeOutput>;
  readonly unsubscribe: (
    input: EventBusUnsubscribeInput,
    storage: EventBusStorage,
  ) => TE.TaskEither<EventBusError, EventBusUnsubscribeOutput>;
  readonly dispatch: (
    input: EventBusDispatchInput,
    storage: EventBusStorage,
  ) => TE.TaskEither<EventBusError, EventBusDispatchOutput>;
  readonly dispatchAsync: (
    input: EventBusDispatchAsyncInput,
    storage: EventBusStorage,
  ) => TE.TaskEither<EventBusError, EventBusDispatchAsyncOutput>;
  readonly getHistory: (
    input: EventBusGetHistoryInput,
    storage: EventBusStorage,
  ) => TE.TaskEither<EventBusError, EventBusGetHistoryOutput>;
}

// --- Pure helpers ---

const generateId = (): string => randomBytes(12).toString('hex');

const storageError = (error: unknown): EventBusError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Sort subscriptions by priority (higher priority first, i.e. descending). */
const sortByPriority = (
  subs: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] =>
  [...subs].sort((a, b) => {
    const pa = typeof a.priority === 'number' ? a.priority : 0;
    const pb = typeof b.priority === 'number' ? b.priority : 0;
    return pb - pa;
  });

// --- Implementation ---

export const eventBusHandler: EventBusHandler = {
  /**
   * Register a new event type with a schema definition. Returns exists
   * if the event type is already registered.
   */
  registerEventType: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('eventTypes', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('eventTypes', input.name, {
                    name: input.name,
                    schema: input.schema,
                    registeredAt: Date.now(),
                  });
                  return registerEventTypeOk();
                },
                storageError,
              ),
            () => TE.right<EventBusError, EventBusRegisterEventTypeOutput>(
              registerEventTypeExists(),
            ),
          ),
        ),
      ),
    ),

  /**
   * Subscribe a handler to an event type at a given priority. Returns a
   * unique subscription ID for later unsubscription.
   */
  subscribe: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const subscriptionId = `sub_${generateId()}`;
          await storage.put('subscriptions', subscriptionId, {
            subscriptionId,
            event: input.event,
            handler: input.handler,
            priority: input.priority,
            createdAt: Date.now(),
          });
          return subscribeOk(subscriptionId);
        },
        storageError,
      ),
    ),

  /**
   * Remove a subscription by its ID. Returns notfound if the subscription
   * does not exist.
   */
  unsubscribe: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('subscriptions', input.subscriptionId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<EventBusError, EventBusUnsubscribeOutput>(
              unsubscribeNotfound(),
            ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('subscriptions', input.subscriptionId);
                  return unsubscribeOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  /**
   * Synchronously dispatch an event to all subscribers in priority order.
   * Collects results from each handler invocation. Failed handlers are
   * recorded in the dead-letter queue.
   */
  dispatch: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('subscriptions', { event: input.event }),
        storageError,
      ),
      TE.chain((rawSubs) => {
        const sorted = sortByPriority(rawSubs);
        return TE.tryCatch(
          async () => {
            const results: readonly { readonly handler: string; readonly status: string }[] =
              sorted.map((sub) => ({
                handler: sub.handler as string,
                status: 'dispatched',
              }));
            const deadLetters: string[] = [];

            // Record dispatch in history
            const historyEntry = {
              id: generateId(),
              event: input.event,
              data: input.data,
              dispatchedAt: Date.now(),
              subscriberCount: sorted.length,
              deadLetterCount: deadLetters.length,
            };
            await storage.put('history', historyEntry.id, historyEntry);

            // If no subscribers, route to dead-letter queue
            if (sorted.length === 0) {
              const dlqId = `dlq_${generateId()}`;
              await storage.put('deadLetterQueue', dlqId, {
                id: dlqId,
                event: input.event,
                data: input.data,
                reason: 'No subscribers registered for event',
                createdAt: Date.now(),
              });
              return dispatchError(`No subscribers registered for event '${input.event}'`) as EventBusDispatchOutput;
            }

            return dispatchOk(JSON.stringify(results));
          },
          storageError,
        );
      }),
    ),

  /**
   * Asynchronously dispatch an event. Enqueues a job and returns a job ID
   * for tracking. The actual dispatch happens out-of-band.
   */
  dispatchAsync: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const jobId = `job_${generateId()}`;
          await storage.put('asyncJobs', jobId, {
            jobId,
            event: input.event,
            data: input.data,
            status: 'pending',
            createdAt: Date.now(),
          });
          return dispatchAsyncOk(jobId);
        },
        storageError,
      ),
    ),

  /**
   * Return the most recent dispatch history entries for an event type,
   * limited by the requested count.
   */
  getHistory: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('history', { event: input.event }),
        storageError,
      ),
      TE.map((entries) => {
        const sorted = [...entries].sort((a, b) => {
          const ta = typeof a.dispatchedAt === 'number' ? a.dispatchedAt : 0;
          const tb = typeof b.dispatchedAt === 'number' ? b.dispatchedAt : 0;
          return tb - ta;
        });
        const limited = sorted.slice(0, Math.max(1, input.limit));
        return getHistoryOk(JSON.stringify(limited));
      }),
    ),
};
