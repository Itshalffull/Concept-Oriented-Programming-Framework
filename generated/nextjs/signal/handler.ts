// Signal — Reactive signal/observable value management
// Creates named signals with typed values, tracks version on every write,
// enforces readonly semantics for derived/computed signals, and supports
// batch updates with partial-failure reporting.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SignalStorage,
  SignalCreateInput,
  SignalCreateOutput,
  SignalReadInput,
  SignalReadOutput,
  SignalWriteInput,
  SignalWriteOutput,
  SignalBatchInput,
  SignalBatchOutput,
  SignalDisposeInput,
  SignalDisposeOutput,
} from './types.js';

import {
  createOk,
  createInvalid,
  readOk,
  readNotfound,
  writeOk,
  writeReadonly,
  writeNotfound,
  batchOk,
  batchPartial,
  disposeOk,
  disposeNotfound,
} from './types.js';

export interface SignalError {
  readonly code: string;
  readonly message: string;
}

export interface SignalHandler {
  readonly create: (
    input: SignalCreateInput,
    storage: SignalStorage,
  ) => TE.TaskEither<SignalError, SignalCreateOutput>;
  readonly read: (
    input: SignalReadInput,
    storage: SignalStorage,
  ) => TE.TaskEither<SignalError, SignalReadOutput>;
  readonly write: (
    input: SignalWriteInput,
    storage: SignalStorage,
  ) => TE.TaskEither<SignalError, SignalWriteOutput>;
  readonly batch: (
    input: SignalBatchInput,
    storage: SignalStorage,
  ) => TE.TaskEither<SignalError, SignalBatchOutput>;
  readonly dispose: (
    input: SignalDisposeInput,
    storage: SignalStorage,
  ) => TE.TaskEither<SignalError, SignalDisposeOutput>;
}

const storageError = (error: unknown): SignalError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Valid signal kinds: "writable" signals can be updated, "computed" and "readonly" cannot
const VALID_KINDS: readonly string[] = ['writable', 'computed', 'readonly'];
const READONLY_KINDS: readonly string[] = ['computed', 'readonly'];

// --- Implementation ---

export const signalHandler: SignalHandler = {
  // Create a new signal with a name, kind, and initial value.
  // Validates that the kind is one of the supported signal types.
  create: (input, storage) => {
    if (!input.signal || input.signal.trim().length === 0) {
      return TE.right(createInvalid('Signal name must be non-empty'));
    }

    if (!VALID_KINDS.includes(input.kind)) {
      return TE.right(createInvalid(
        `Invalid signal kind '${input.kind}'; must be one of: ${VALID_KINDS.join(', ')}`,
      ));
    }

    return pipe(
      TE.tryCatch(
        () => storage.get('signals', input.signal),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('signals', input.signal, {
                    signal: input.signal,
                    kind: input.kind,
                    value: input.initialValue,
                    version: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  return createOk(input.signal);
                },
                storageError,
              ),
            () => TE.right(createInvalid(`Signal '${input.signal}' already exists`)),
          ),
        ),
      ),
    );
  },

  // Read the current value and version of a signal.
  read: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('signals', input.signal),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(readNotfound(`Signal '${input.signal}' not found`)),
            (found) => {
              const data = found as Record<string, unknown>;
              const value = String(data.value ?? '');
              const version = typeof data.version === 'number' ? data.version : 0;
              return TE.right(readOk(input.signal, value, version));
            },
          ),
        ),
      ),
    ),

  // Write a new value to a signal. Increments the version counter.
  // Rejects writes to computed/readonly signals.
  write: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('signals', input.signal),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(writeNotfound(`Signal '${input.signal}' not found`)),
            (found) => {
              const data = found as Record<string, unknown>;
              const kind = String(data.kind ?? '');

              if (READONLY_KINDS.includes(kind)) {
                return TE.right(writeReadonly(
                  `Signal '${input.signal}' is ${kind} and cannot be written to`,
                ));
              }

              const currentVersion = typeof data.version === 'number' ? data.version : 0;
              const nextVersion = currentVersion + 1;

              return TE.tryCatch(
                async () => {
                  await storage.put('signals', input.signal, {
                    ...data,
                    value: input.value,
                    version: nextVersion,
                    updatedAt: new Date().toISOString(),
                  });
                  return writeOk(input.signal, nextVersion);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Batch-update multiple signals. The input is a JSON-encoded array of
  // {signal, value} pairs. Reports partial failures if some signals
  // cannot be written (missing or readonly).
  batch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          let updates: readonly { readonly signal: string; readonly value: string }[];
          try {
            updates = JSON.parse(input.signals) as { signal: string; value: string }[];
          } catch {
            return batchPartial('Invalid JSON in signals field', 0, 1);
          }

          if (!Array.isArray(updates) || updates.length === 0) {
            return batchOk(0);
          }

          let succeeded = 0;
          let failed = 0;
          const failures: string[] = [];

          for (const update of updates) {
            const record = await storage.get('signals', update.signal);
            if (!record) {
              failed += 1;
              failures.push(`${update.signal}: not found`);
              continue;
            }

            const data = record as Record<string, unknown>;
            const kind = String(data.kind ?? '');

            if (READONLY_KINDS.includes(kind)) {
              failed += 1;
              failures.push(`${update.signal}: readonly`);
              continue;
            }

            const currentVersion = typeof data.version === 'number' ? data.version : 0;
            await storage.put('signals', update.signal, {
              ...data,
              value: update.value,
              version: currentVersion + 1,
              updatedAt: new Date().toISOString(),
            });
            succeeded += 1;
          }

          if (failed > 0) {
            return batchPartial(failures.join('; '), succeeded, failed);
          }

          return batchOk(succeeded);
        },
        storageError,
      ),
    ),

  // Dispose a signal, removing it from storage. Returns notfound if absent.
  dispose: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('signals', input.signal),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(disposeNotfound(`Signal '${input.signal}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('signals', input.signal);
                  return disposeOk(input.signal);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
