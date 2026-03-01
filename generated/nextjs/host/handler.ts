// Host — Host/server registration, capacity tracking, and workload assignment
// Manages host lifecycle: mounting concepts into view zones, readiness verification,
// resource tracking, unmounting with binding cleanup, refresh, and error recording.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  HostStorage,
  HostMountInput,
  HostMountOutput,
  HostReadyInput,
  HostReadyOutput,
  HostTrackResourceInput,
  HostTrackResourceOutput,
  HostUnmountInput,
  HostUnmountOutput,
  HostRefreshInput,
  HostRefreshOutput,
  HostSetErrorInput,
  HostSetErrorOutput,
} from './types.js';

import {
  mountOk,
  mountInvalid,
  readyOk,
  readyInvalid,
  trackResourceOk,
  trackResourceNotfound,
  unmountOk,
  unmountNotfound,
  refreshOk,
  refreshNotfound,
  refreshInvalid,
  setErrorOk,
  setErrorNotfound,
} from './types.js';

export interface HostError {
  readonly code: string;
  readonly message: string;
}

export interface HostHandler {
  readonly mount: (
    input: HostMountInput,
    storage: HostStorage,
  ) => TE.TaskEither<HostError, HostMountOutput>;
  readonly ready: (
    input: HostReadyInput,
    storage: HostStorage,
  ) => TE.TaskEither<HostError, HostReadyOutput>;
  readonly trackResource: (
    input: HostTrackResourceInput,
    storage: HostStorage,
  ) => TE.TaskEither<HostError, HostTrackResourceOutput>;
  readonly unmount: (
    input: HostUnmountInput,
    storage: HostStorage,
  ) => TE.TaskEither<HostError, HostUnmountOutput>;
  readonly refresh: (
    input: HostRefreshInput,
    storage: HostStorage,
  ) => TE.TaskEither<HostError, HostRefreshOutput>;
  readonly setError: (
    input: HostSetErrorInput,
    storage: HostStorage,
  ) => TE.TaskEither<HostError, HostSetErrorOutput>;
}

const toError = (error: unknown): HostError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const hostHandler: HostHandler = {
  mount: (input, storage) => {
    // Validate the mount level (must be >= 0)
    if (input.level < 0) {
      return TE.right(mountInvalid(`Mount level ${input.level} is invalid; must be >= 0`));
    }

    return pipe(
      TE.tryCatch(
        () => storage.get('hosts', input.host),
        toError,
      ),
      TE.chain((existing) => {
        // If the host is already mounted, reject duplicate
        if (existing) {
          return TE.right<HostError, HostMountOutput>(
            mountInvalid(`Host ${input.host} is already mounted`),
          );
        }

        return TE.tryCatch(
          async () => {
            const zoneValue = pipe(
              input.zone,
              O.getOrElse(() => 'default'),
            );
            await storage.put('hosts', input.host, {
              host: input.host,
              concept: input.concept,
              view: input.view,
              level: input.level,
              zone: zoneValue,
              status: 'mounted',
              machines: [],
              binding: null,
              resources: [],
              mountedAt: new Date().toISOString(),
            });
            return mountOk(input.host);
          },
          toError,
        );
      }),
    );
  },

  ready: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hosts', input.host),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<HostError, HostReadyOutput>(
              readyInvalid(`Host ${input.host} is not mounted`),
            ),
            (existing) => {
              const status = String((existing as Record<string, unknown>).status ?? '');
              if (status === 'error') {
                return TE.right<HostError, HostReadyOutput>(
                  readyInvalid(`Host ${input.host} is in error state`),
                );
              }

              return TE.tryCatch(
                async () => {
                  await storage.put('hosts', input.host, {
                    ...existing,
                    status: 'ready',
                    readyAt: new Date().toISOString(),
                  });
                  return readyOk(input.host);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  trackResource: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hosts', input.host),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<HostError, HostTrackResourceOutput>(
              trackResourceNotfound(`Host ${input.host} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const resources = ((existing as Record<string, unknown>).resources as readonly Record<string, unknown>[] | undefined) ?? [];
                  await storage.put('hosts', input.host, {
                    ...existing,
                    resources: [...resources, { kind: input.kind, ref: input.ref }],
                  });
                  return trackResourceOk(input.host);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  unmount: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hosts', input.host),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<HostError, HostUnmountOutput>(
              unmountNotfound(`Host ${input.host} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const machines = ((existing as Record<string, unknown>).machines as readonly string[] | undefined) ?? [];
                  const binding = (existing as Record<string, unknown>).binding;
                  await storage.delete('hosts', input.host);
                  return unmountOk(
                    input.host,
                    new Set(machines),
                    O.fromNullable(binding ? String(binding) : null),
                  );
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  refresh: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hosts', input.host),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<HostError, HostRefreshOutput>(
              refreshNotfound(`Host ${input.host} not found`),
            ),
            (existing) => {
              const status = String((existing as Record<string, unknown>).status ?? '');
              if (status === 'error') {
                return TE.right<HostError, HostRefreshOutput>(
                  refreshInvalid(`Cannot refresh host ${input.host} while in error state`),
                );
              }

              return TE.tryCatch(
                async () => {
                  await storage.put('hosts', input.host, {
                    ...existing,
                    refreshedAt: new Date().toISOString(),
                  });
                  return refreshOk(input.host);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  setError: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hosts', input.host),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<HostError, HostSetErrorOutput>(
              setErrorNotfound(`Host ${input.host} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('hosts', input.host, {
                    ...existing,
                    status: 'error',
                    errorInfo: input.errorInfo,
                    errorAt: new Date().toISOString(),
                  });
                  return setErrorOk(input.host);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
