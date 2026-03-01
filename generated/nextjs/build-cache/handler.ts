// BuildCache — handler.ts
// Build output caching with content-hash lookups, staleness tracking, and targeted invalidation.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  BuildCacheStorage,
  BuildCacheCheckInput,
  BuildCacheCheckOutput,
  BuildCacheRecordInput,
  BuildCacheRecordOutput,
  BuildCacheInvalidateInput,
  BuildCacheInvalidateOutput,
  BuildCacheInvalidateBySourceInput,
  BuildCacheInvalidateBySourceOutput,
  BuildCacheInvalidateByKindInput,
  BuildCacheInvalidateByKindOutput,
  BuildCacheInvalidateAllInput,
  BuildCacheInvalidateAllOutput,
  BuildCacheStatusInput,
  BuildCacheStatusOutput,
  BuildCacheStaleStepsInput,
  BuildCacheStaleStepsOutput,
} from './types.js';

import {
  checkUnchanged,
  checkChanged,
  recordOk,
  invalidateOk,
  invalidateNotFound,
  invalidateBySourceOk,
  invalidateByKindOk,
  invalidateAllOk,
  statusOk,
  staleStepsOk,
} from './types.js';

export interface BuildCacheError {
  readonly code: string;
  readonly message: string;
}

export interface BuildCacheHandler {
  readonly check: (
    input: BuildCacheCheckInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheCheckOutput>;
  readonly record: (
    input: BuildCacheRecordInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheRecordOutput>;
  readonly invalidate: (
    input: BuildCacheInvalidateInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateOutput>;
  readonly invalidateBySource: (
    input: BuildCacheInvalidateBySourceInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateBySourceOutput>;
  readonly invalidateByKind: (
    input: BuildCacheInvalidateByKindInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateByKindOutput>;
  readonly invalidateAll: (
    input: BuildCacheInvalidateAllInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateAllOutput>;
  readonly status: (
    input: BuildCacheStatusInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheStatusOutput>;
  readonly staleSteps: (
    input: BuildCacheStaleStepsInput,
    storage: BuildCacheStorage,
  ) => TE.TaskEither<BuildCacheError, BuildCacheStaleStepsOutput>;
}

const toError = (error: unknown): BuildCacheError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const buildCacheHandler: BuildCacheHandler = {
  // Look up the cache entry for a build step by its key. If a record exists with a
  // matching inputHash, the step is unchanged (cache hit). If the hash differs or
  // the step is non-deterministic we report changed (cache miss).
  check: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('cache_entry', input.stepKey),
        toError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            (): BuildCacheCheckOutput => checkChanged(O.none),
            (found): BuildCacheCheckOutput => {
              const storedHash = String(found['inputHash'] ?? '');
              const storedOutputRef = found['outputRef'] as string | undefined;
              const lastRun = new Date(String(found['lastRun'] ?? Date.now()));
              if (storedHash === input.inputHash && input.deterministic) {
                return checkUnchanged(
                  lastRun,
                  O.fromNullable(storedOutputRef),
                );
              }
              return checkChanged(O.some(storedHash));
            },
          ),
        ),
      ),
    ),

  // Persist a cache entry after a build step completes. The entry stores the input
  // hash, output hash, optional output reference and source locator, plus a
  // timestamp so staleness can be evaluated later.
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entry: Record<string, unknown> = {
            stepKey: input.stepKey,
            inputHash: input.inputHash,
            outputHash: input.outputHash,
            outputRef: pipe(input.outputRef, O.toNullable),
            sourceLocator: pipe(input.sourceLocator, O.toNullable),
            deterministic: input.deterministic,
            lastRun: new Date().toISOString(),
            stale: false,
          };
          await storage.put('cache_entry', input.stepKey, entry);
          return recordOk(input.stepKey);
        },
        toError,
      ),
    ),

  // Invalidate a single step's cache entry. Returns notFound when the step has no
  // cached record to remove.
  invalidate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('cache_entry', input.stepKey),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<BuildCacheError, BuildCacheInvalidateOutput>(invalidateNotFound()),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.delete('cache_entry', input.stepKey),
                  toError,
                ),
                TE.map((): BuildCacheInvalidateOutput => invalidateOk()),
              ),
          ),
        ),
      ),
    ),

  // Invalidate every cache entry whose sourceLocator matches the supplied value.
  // Returns the list of step keys that were invalidated.
  invalidateBySource: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('cache_entry', { sourceLocator: input.sourceLocator }),
        toError,
      ),
      TE.chain((records) =>
        pipe(
          TE.tryCatch(
            async () => {
              const keys: readonly string[] = records.map(
                (r) => String(r['stepKey']),
              );
              for (const key of keys) {
                await storage.delete('cache_entry', key);
              }
              return invalidateBySourceOk(keys);
            },
            toError,
          ),
        ),
      ),
    ),

  // Invalidate every cache entry associated with a particular kind name. The kind
  // is matched via a stored kindName field on each entry.
  invalidateByKind: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('cache_entry', { kindName: input.kindName }),
        toError,
      ),
      TE.chain((records) =>
        pipe(
          TE.tryCatch(
            async () => {
              const keys: readonly string[] = records.map(
                (r) => String(r['stepKey']),
              );
              for (const key of keys) {
                await storage.delete('cache_entry', key);
              }
              return invalidateByKindOk(keys);
            },
            toError,
          ),
        ),
      ),
    ),

  // Wipe all cache entries. Returns the count of entries that were cleared.
  invalidateAll: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('cache_entry'),
        toError,
      ),
      TE.chain((records) =>
        pipe(
          TE.tryCatch(
            async () => {
              const count = records.length;
              for (const r of records) {
                await storage.delete('cache_entry', String(r['stepKey']));
              }
              return invalidateAllOk(count);
            },
            toError,
          ),
        ),
      ),
    ),

  // Return every cache entry with its staleness flag. An entry is considered stale
  // when its deterministic flag is false or when the recorded inputHash no longer
  // matches the latest known hash.
  status: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('cache_entry'),
        toError,
      ),
      TE.map((records) => {
        const entries = records.map((r) => ({
          stepKey: String(r['stepKey']),
          inputHash: String(r['inputHash']),
          lastRun: new Date(String(r['lastRun'] ?? Date.now())),
          stale: r['stale'] === true || r['deterministic'] === false,
        }));
        return statusOk(entries);
      }),
    ),

  // Convenience projection: return only the step keys that are currently stale.
  staleSteps: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('cache_entry'),
        toError,
      ),
      TE.map((records) => {
        const stale = records
          .filter((r) => r['stale'] === true || r['deterministic'] === false)
          .map((r) => String(r['stepKey']));
        return staleStepsOk(stale);
      }),
    ),
};
