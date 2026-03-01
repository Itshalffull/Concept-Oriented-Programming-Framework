// Transport — Message transport abstraction layer
// Configures named transports with connection parameters and retry policies,
// fetches data with cache-aware responses, queues mutations for ordered delivery,
// and flushes queued messages with partial-failure reporting.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TransportStorage,
  TransportConfigureInput,
  TransportConfigureOutput,
  TransportFetchInput,
  TransportFetchOutput,
  TransportMutateInput,
  TransportMutateOutput,
  TransportFlushQueueInput,
  TransportFlushQueueOutput,
} from './types.js';

import {
  configureOk,
  configureInvalid,
  fetchOk,
  fetchCached,
  fetchError,
  mutateOk,
  mutateQueued,
  mutateError,
  flushQueueOk,
  flushQueuePartial,
} from './types.js';

export interface TransportError {
  readonly code: string;
  readonly message: string;
}

export interface TransportHandler {
  readonly configure: (
    input: TransportConfigureInput,
    storage: TransportStorage,
  ) => TE.TaskEither<TransportError, TransportConfigureOutput>;
  readonly fetch: (
    input: TransportFetchInput,
    storage: TransportStorage,
  ) => TE.TaskEither<TransportError, TransportFetchOutput>;
  readonly mutate: (
    input: TransportMutateInput,
    storage: TransportStorage,
  ) => TE.TaskEither<TransportError, TransportMutateOutput>;
  readonly flushQueue: (
    input: TransportFlushQueueInput,
    storage: TransportStorage,
  ) => TE.TaskEither<TransportError, TransportFlushQueueOutput>;
}

const storageError = (error: unknown): TransportError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Valid transport kinds
const VALID_KINDS: readonly string[] = ['http', 'grpc', 'websocket', 'memory', 'queue'];

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

// --- Implementation ---

export const transportHandler: TransportHandler = {
  // Configure a named transport with kind, optional base URL, auth, and retry policy.
  // Validates the transport kind before persisting.
  configure: (input, storage) => {
    if (!VALID_KINDS.includes(input.kind)) {
      return TE.right(configureInvalid(
        `Invalid transport kind '${input.kind}'; must be one of: ${VALID_KINDS.join(', ')}`,
      ));
    }

    if (!input.transport || input.transport.trim().length === 0) {
      return TE.right(configureInvalid('Transport name must be non-empty'));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          await storage.put('transports', input.transport, {
            transport: input.transport,
            kind: input.kind,
            baseUrl: input.baseUrl,
            auth: input.auth,
            retryPolicy: input.retryPolicy,
            status: 'configured',
            configuredAt: now,
            queueSize: 0,
          });
          return configureOk(input.transport);
        },
        storageError,
      ),
    );
  },

  // Fetch data through a configured transport. Checks the cache first;
  // if a cached response exists within TTL, returns it with age metadata.
  // If the transport is not configured, returns an error.
  fetch: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('transports', input.transport),
        storageError,
      ),
      TE.chain((transportRecord) =>
        pipe(
          O.fromNullable(transportRecord),
          O.fold(
            () => TE.right(fetchError(input.transport, 404, `Transport '${input.transport}' not configured`)),
            (config) => {
              const configData = config as Record<string, unknown>;
              const cacheKey = `${input.transport}::${input.query}`;

              return pipe(
                TE.tryCatch(
                  () => storage.get('transport_cache', cacheKey),
                  storageError,
                ),
                TE.chain((cached) =>
                  pipe(
                    O.fromNullable(cached),
                    O.fold(
                      () =>
                        // No cache hit: simulate a fresh fetch
                        TE.tryCatch(
                          async () => {
                            const now = new Date().toISOString();
                            const data = JSON.stringify({
                              transport: input.transport,
                              query: input.query,
                              fetchedAt: now,
                            });

                            // Store in cache
                            await storage.put('transport_cache', cacheKey, {
                              data,
                              cachedAt: Date.now(),
                              transport: input.transport,
                              query: input.query,
                            });

                            return fetchOk(input.transport, data);
                          },
                          storageError,
                        ),
                      (cacheRecord) => {
                        const cacheData = cacheRecord as Record<string, unknown>;
                        const cachedAt = typeof cacheData.cachedAt === 'number'
                          ? cacheData.cachedAt
                          : 0;
                        const ageMs = Date.now() - cachedAt;

                        // If cache is still fresh, return cached data
                        if (ageMs < CACHE_TTL_MS) {
                          const data = String(cacheData.data ?? '');
                          return TE.right(fetchCached(input.transport, data, ageMs));
                        }

                        // Cache expired: fetch fresh data
                        return TE.tryCatch(
                          async () => {
                            const now = new Date().toISOString();
                            const data = JSON.stringify({
                              transport: input.transport,
                              query: input.query,
                              fetchedAt: now,
                            });

                            await storage.put('transport_cache', cacheKey, {
                              data,
                              cachedAt: Date.now(),
                              transport: input.transport,
                              query: input.query,
                            });

                            return fetchOk(input.transport, data);
                          },
                          storageError,
                        );
                      },
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  // Queue a mutation operation on a transport. If the transport is offline
  // or at capacity, the mutation is queued for later delivery.
  mutate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('transports', input.transport),
        storageError,
      ),
      TE.chain((transportRecord) =>
        pipe(
          O.fromNullable(transportRecord),
          O.fold(
            () => TE.right(mutateError(input.transport, 404, `Transport '${input.transport}' not configured`)),
            (config) => {
              const configData = config as Record<string, unknown>;
              const status = String(configData.status ?? 'configured');
              const currentQueueSize = typeof configData.queueSize === 'number'
                ? configData.queueSize
                : 0;

              // If transport is offline, queue the mutation
              if (status === 'offline' || status === 'error') {
                const queuePosition = currentQueueSize + 1;

                return TE.tryCatch(
                  async () => {
                    const queueKey = `${input.transport}::queue::${queuePosition}`;
                    await storage.put('transport_queue', queueKey, {
                      transport: input.transport,
                      action: input.action,
                      input: input.input,
                      position: queuePosition,
                      queuedAt: new Date().toISOString(),
                    });

                    // Update queue size on the transport
                    await storage.put('transports', input.transport, {
                      ...configData,
                      queueSize: queuePosition,
                    });

                    return mutateQueued(input.transport, queuePosition);
                  },
                  storageError,
                );
              }

              // Transport is online: execute the mutation
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const result = JSON.stringify({
                    transport: input.transport,
                    action: input.action,
                    executedAt: now,
                  });

                  // Log the mutation
                  await storage.put('transport_mutations', `${input.transport}::${now}`, {
                    transport: input.transport,
                    action: input.action,
                    input: input.input,
                    result,
                    executedAt: now,
                  });

                  return mutateOk(input.transport, result);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Flush all queued mutations for a transport. Attempts to send each
  // queued message and reports partial failures.
  flushQueue: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('transports', input.transport),
        storageError,
      ),
      TE.chain((transportRecord) =>
        pipe(
          O.fromNullable(transportRecord),
          O.fold(
            () => TE.right(flushQueuePartial(input.transport, 0, 1)),
            (config) => {
              const configData = config as Record<string, unknown>;
              const queueSize = typeof configData.queueSize === 'number'
                ? configData.queueSize
                : 0;

              if (queueSize === 0) {
                return TE.right(flushQueueOk(input.transport, 0));
              }

              return TE.tryCatch(
                async () => {
                  let sent = 0;
                  let failed = 0;

                  for (let i = 1; i <= queueSize; i++) {
                    const queueKey = `${input.transport}::queue::${i}`;
                    const queuedItem = await storage.get('transport_queue', queueKey);

                    if (queuedItem) {
                      try {
                        // Attempt to deliver the queued mutation
                        const itemData = queuedItem as Record<string, unknown>;
                        const now = new Date().toISOString();
                        await storage.put('transport_mutations', `${input.transport}::flush::${now}::${i}`, {
                          ...itemData,
                          flushedAt: now,
                        });

                        // Remove from queue
                        await storage.delete('transport_queue', queueKey);
                        sent += 1;
                      } catch {
                        failed += 1;
                      }
                    }
                  }

                  // Reset queue size
                  await storage.put('transports', input.transport, {
                    ...configData,
                    queueSize: failed,
                  });

                  if (failed > 0) {
                    return flushQueuePartial(input.transport, sent, failed);
                  }

                  return flushQueueOk(input.transport, sent);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
