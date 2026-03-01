// Queue — handler.ts
// Priority message queue with claim/release semantics and dead-letter support.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  QueueStorage,
  QueueEnqueueInput,
  QueueEnqueueOutput,
  QueueClaimInput,
  QueueClaimOutput,
  QueueProcessInput,
  QueueProcessOutput,
  QueueReleaseInput,
  QueueReleaseOutput,
  QueueDeleteInput,
  QueueDeleteOutput,
} from './types.js';

import {
  enqueueOk,
  enqueueNotfound,
  claimOk,
  claimEmpty,
  processOk,
  processNotfound,
  releaseOk,
  releaseNotfound,
  deleteOk,
  deleteNotfound,
} from './types.js';

export interface QueueError {
  readonly code: string;
  readonly message: string;
}

export interface QueueHandler {
  readonly enqueue: (
    input: QueueEnqueueInput,
    storage: QueueStorage,
  ) => TE.TaskEither<QueueError, QueueEnqueueOutput>;
  readonly claim: (
    input: QueueClaimInput,
    storage: QueueStorage,
  ) => TE.TaskEither<QueueError, QueueClaimOutput>;
  readonly process: (
    input: QueueProcessInput,
    storage: QueueStorage,
  ) => TE.TaskEither<QueueError, QueueProcessOutput>;
  readonly release: (
    input: QueueReleaseInput,
    storage: QueueStorage,
  ) => TE.TaskEither<QueueError, QueueReleaseOutput>;
  readonly delete: (
    input: QueueDeleteInput,
    storage: QueueStorage,
  ) => TE.TaskEither<QueueError, QueueDeleteOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): QueueError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateItemId = (queue: string, timestamp: number): string =>
  `${queue}:${timestamp}:${Math.random().toString(36).slice(2, 10)}`;

// --- Implementation ---

export const queueHandler: QueueHandler = {
  // Enqueue a new item with priority. Verifies the target queue exists,
  // assigns a unique item ID, and stores the item sorted by priority.
  enqueue: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queue_meta', input.queue),
        storageError,
      ),
      TE.chain((queueMeta) =>
        pipe(
          O.fromNullable(queueMeta),
          O.fold(
            // Auto-create the queue if it does not exist, then enqueue
            () =>
              TE.tryCatch(
                async () => {
                  const now = Date.now();
                  await storage.put('queue_meta', input.queue, {
                    queue: input.queue,
                    createdAt: new Date(now).toISOString(),
                    depth: 1,
                  });
                  const itemId = generateItemId(input.queue, now);
                  await storage.put('queue_item', itemId, {
                    itemId,
                    queue: input.queue,
                    item: input.item,
                    priority: input.priority,
                    status: 'pending',
                    enqueuedAt: new Date(now).toISOString(),
                    claimedBy: null,
                  });
                  return enqueueOk(itemId);
                },
                storageError,
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = Date.now();
                  const currentDepth = (existing as Record<string, unknown>).depth as number ?? 0;
                  await storage.put('queue_meta', input.queue, {
                    ...existing,
                    depth: currentDepth + 1,
                  });
                  const itemId = generateItemId(input.queue, now);
                  await storage.put('queue_item', itemId, {
                    itemId,
                    queue: input.queue,
                    item: input.item,
                    priority: input.priority,
                    status: 'pending',
                    enqueuedAt: new Date(now).toISOString(),
                    claimedBy: null,
                  });
                  return enqueueOk(itemId);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Claim the highest-priority pending item from the queue for a worker.
  // Returns the item content or empty if no pending items exist.
  claim: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('queue_item', { queue: input.queue, status: 'pending' }),
        storageError,
      ),
      TE.chain((items) => {
        if (items.length === 0) {
          return TE.right(claimEmpty(`Queue '${input.queue}' has no pending items`));
        }
        // Sort by priority descending (highest priority first)
        const sorted = [...items].sort(
          (a, b) => ((b as Record<string, unknown>).priority as number) - ((a as Record<string, unknown>).priority as number),
        );
        const top = sorted[0] as Record<string, unknown>;
        return TE.tryCatch(
          async () => {
            await storage.put('queue_item', top.itemId as string, {
              ...top,
              status: 'claimed',
              claimedBy: input.worker,
              claimedAt: new Date().toISOString(),
            });
            return claimOk(top.item as string);
          },
          storageError,
        );
      }),
    ),

  // Mark a claimed item as processed with a result.
  // Decrements queue depth and records the processing outcome.
  process: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queue_item', input.itemId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(processNotfound(`Item '${input.itemId}' not found in queue '${input.queue}'`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('queue_item', input.itemId, {
                    ...found,
                    status: 'processed',
                    result: input.result,
                    processedAt: new Date().toISOString(),
                  });
                  // Decrement queue depth
                  const meta = await storage.get('queue_meta', input.queue);
                  if (meta) {
                    const currentDepth = (meta as Record<string, unknown>).depth as number ?? 1;
                    await storage.put('queue_meta', input.queue, {
                      ...meta,
                      depth: Math.max(0, currentDepth - 1),
                    });
                  }
                  return processOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Release a claimed item back to pending status so another worker can claim it.
  // Typically used when a worker fails or times out.
  release: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queue_item', input.itemId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(releaseNotfound(`Item '${input.itemId}' not found in queue '${input.queue}'`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const retryCount = ((found as Record<string, unknown>).retryCount as number ?? 0) + 1;
                  await storage.put('queue_item', input.itemId, {
                    ...found,
                    status: 'pending',
                    claimedBy: null,
                    claimedAt: null,
                    retryCount,
                    releasedAt: new Date().toISOString(),
                  });
                  return releaseOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Permanently remove a processed or dead-lettered item from the queue.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queue_item', input.itemId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(deleteNotfound(`Item '${input.itemId}' not found in queue '${input.queue}'`)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('queue_item', input.itemId);
                  // Decrement queue depth if item was still pending
                  const meta = await storage.get('queue_meta', input.queue);
                  if (meta) {
                    const currentDepth = (meta as Record<string, unknown>).depth as number ?? 1;
                    await storage.put('queue_meta', input.queue, {
                      ...meta,
                      depth: Math.max(0, currentDepth - 1),
                    });
                  }
                  return deleteOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
