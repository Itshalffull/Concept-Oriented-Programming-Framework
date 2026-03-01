// Flag — Entity flagging and flag-count aggregation
// Creates user-scoped flags on entities, prevents duplicate flagging,
// checks flag status, and counts total flags per entity/type.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FlagStorage,
  FlagFlagInput,
  FlagFlagOutput,
  FlagUnflagInput,
  FlagUnflagOutput,
  FlagIsFlaggedInput,
  FlagIsFlaggedOutput,
  FlagGetCountInput,
  FlagGetCountOutput,
} from './types.js';

import {
  flagOk,
  flagExists,
  unflagOk,
  unflagNotfound,
  isFlaggedOk,
  getCountOk,
} from './types.js';

export interface FlagError {
  readonly code: string;
  readonly message: string;
}

export interface FlagHandler {
  readonly flag: (
    input: FlagFlagInput,
    storage: FlagStorage,
  ) => TE.TaskEither<FlagError, FlagFlagOutput>;
  readonly unflag: (
    input: FlagUnflagInput,
    storage: FlagStorage,
  ) => TE.TaskEither<FlagError, FlagUnflagOutput>;
  readonly isFlagged: (
    input: FlagIsFlaggedInput,
    storage: FlagStorage,
  ) => TE.TaskEither<FlagError, FlagIsFlaggedOutput>;
  readonly getCount: (
    input: FlagGetCountInput,
    storage: FlagStorage,
  ) => TE.TaskEither<FlagError, FlagGetCountOutput>;
}

const storageError = (error: unknown): FlagError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Build a composite key that uniquely identifies a flag instance
const flagInstanceKey = (flagType: string, entity: string, user: string): string =>
  `${flagType}::${entity}::${user}`;

// Build a key for the aggregate counter per flagType+entity
const flagCountKey = (flagType: string, entity: string): string =>
  `${flagType}::${entity}`;

// --- Implementation ---

export const flagHandler: FlagHandler = {
  // Flag an entity on behalf of a user. Each user can only flag an entity
  // once per flag type. Also increments the aggregate count.
  flag: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flags', input.flagging),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  // Store the flag instance keyed by flagging id
                  await storage.put('flags', input.flagging, {
                    flagging: input.flagging,
                    flagType: input.flagType,
                    entity: input.entity,
                    user: input.user,
                    createdAt: now,
                  });

                  // Also index by the composite user+entity+type key for isFlagged lookups
                  await storage.put(
                    'flag_index',
                    flagInstanceKey(input.flagType, input.entity, input.user),
                    { flagging: input.flagging, createdAt: now },
                  );

                  // Update the aggregate count
                  const countKey = flagCountKey(input.flagType, input.entity);
                  const countRecord = await storage.get('flag_counts', countKey);
                  const currentCount = countRecord
                    ? (typeof (countRecord as Record<string, unknown>).count === 'number'
                      ? (countRecord as Record<string, unknown>).count as number
                      : 0)
                    : 0;
                  await storage.put('flag_counts', countKey, {
                    flagType: input.flagType,
                    entity: input.entity,
                    count: currentCount + 1,
                  });

                  return flagOk();
                },
                storageError,
              ),
            () =>
              TE.right(flagExists(
                `Flag '${input.flagging}' already exists`,
              )),
          ),
        ),
      ),
    ),

  // Remove a flag by its flagging id. Decrements the aggregate count.
  unflag: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flags', input.flagging),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(unflagNotfound(`Flag '${input.flagging}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const data = found as Record<string, unknown>;
                  const flagType = String(data.flagType ?? '');
                  const entity = String(data.entity ?? '');
                  const user = String(data.user ?? '');

                  // Delete the flag record
                  await storage.delete('flags', input.flagging);

                  // Delete the index entry
                  await storage.delete(
                    'flag_index',
                    flagInstanceKey(flagType, entity, user),
                  );

                  // Decrement the aggregate count
                  const countKey = flagCountKey(flagType, entity);
                  const countRecord = await storage.get('flag_counts', countKey);
                  const currentCount = countRecord
                    ? (typeof (countRecord as Record<string, unknown>).count === 'number'
                      ? (countRecord as Record<string, unknown>).count as number
                      : 0)
                    : 0;
                  const newCount = Math.max(0, currentCount - 1);
                  await storage.put('flag_counts', countKey, {
                    flagType,
                    entity,
                    count: newCount,
                  });

                  return unflagOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Check whether a specific user has flagged a specific entity with a given flag type.
  isFlagged: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get(
          'flag_index',
          flagInstanceKey(input.flagType, input.entity, input.user),
        ),
        storageError,
      ),
      TE.map((record) =>
        isFlaggedOk(record !== null),
      ),
    ),

  // Get the total number of flags for an entity and flag type.
  getCount: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flag_counts', flagCountKey(input.flagType, input.entity)),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getCountOk(0),
            (found) => {
              const count = (found as Record<string, unknown>).count;
              return getCountOk(typeof count === 'number' ? count : 0);
            },
          ),
        ),
      ),
    ),
};
