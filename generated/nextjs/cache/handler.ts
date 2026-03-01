// Cache — handler.ts
// Real fp-ts domain logic for TTL-based caching with tag invalidation and hit/miss tracking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CacheStorage,
  CacheSetInput,
  CacheSetOutput,
  CacheGetInput,
  CacheGetOutput,
  CacheInvalidateInput,
  CacheInvalidateOutput,
  CacheInvalidateByTagsInput,
  CacheInvalidateByTagsOutput,
} from './types.js';

import {
  setOk,
  getOk,
  getMiss,
  invalidateOk,
  invalidateNotfound,
  invalidateByTagsOk,
} from './types.js';

export interface CacheError {
  readonly code: string;
  readonly message: string;
}

export interface CacheHandler {
  readonly set: (
    input: CacheSetInput,
    storage: CacheStorage,
  ) => TE.TaskEither<CacheError, CacheSetOutput>;
  readonly get: (
    input: CacheGetInput,
    storage: CacheStorage,
  ) => TE.TaskEither<CacheError, CacheGetOutput>;
  readonly invalidate: (
    input: CacheInvalidateInput,
    storage: CacheStorage,
  ) => TE.TaskEither<CacheError, CacheInvalidateOutput>;
  readonly invalidateByTags: (
    input: CacheInvalidateByTagsInput,
    storage: CacheStorage,
  ) => TE.TaskEither<CacheError, CacheInvalidateByTagsOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): CacheError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Composite key: bin + key, to isolate entries across cache bins. */
const cacheKey = (bin: string, key: string): string => `${bin}::${key}`;

/** Parse a comma-separated tag string into an array of trimmed tag values. */
const parseTags = (tags: string): readonly string[] =>
  tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);

/** Check if a cache entry has expired based on its createdAt + maxAge. */
const isEntryExpired = (entry: Record<string, unknown>): boolean => {
  const createdAt = typeof entry.createdAt === 'number' ? entry.createdAt : 0;
  const maxAgeMs = typeof entry.maxAge === 'number' ? entry.maxAge * 1000 : 0;
  return maxAgeMs > 0 && Date.now() > createdAt + maxAgeMs;
};

const STATS_KEY = '__cache_stats__';

/** Increment a stats counter in storage (hits or misses). */
const incrementStat = async (
  storage: CacheStorage,
  field: 'hits' | 'misses',
): Promise<void> => {
  const current = await storage.get('stats', STATS_KEY);
  const stats = current ?? { hits: 0, misses: 0 };
  const updated = {
    ...stats,
    [field]: (typeof stats[field] === 'number' ? (stats[field] as number) : 0) + 1,
  };
  await storage.put('stats', STATS_KEY, updated);
};

// --- Implementation ---

export const cacheHandler: CacheHandler = {
  /**
   * Store data in the cache with associated tags and TTL (maxAge in seconds).
   * Each entry is keyed by bin::key and stores creation timestamp for expiry.
   */
  set: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = cacheKey(input.bin, input.key);
          await storage.put('entries', key, {
            bin: input.bin,
            key: input.key,
            data: input.data,
            tags: input.tags,
            maxAge: input.maxAge,
            createdAt: Date.now(),
          });
          return setOk();
        },
        storageError,
      ),
    ),

  /**
   * Retrieve cached data by bin+key. Checks TTL expiry and tracks hit/miss
   * statistics. Expired entries are cleaned up and reported as a miss.
   */
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('entries', cacheKey(input.bin, input.key)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await incrementStat(storage, 'misses');
                  return getMiss() as CacheGetOutput;
                },
                storageError,
              ),
            (entry) => {
              if (isEntryExpired(entry)) {
                // Expired: clean up and report miss
                return TE.tryCatch(
                  async () => {
                    await storage.delete('entries', cacheKey(input.bin, input.key));
                    await incrementStat(storage, 'misses');
                    return getMiss() as CacheGetOutput;
                  },
                  storageError,
                );
              }
              return TE.tryCatch(
                async () => {
                  await incrementStat(storage, 'hits');
                  return getOk(entry.data as string) as CacheGetOutput;
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Invalidate a single cache entry by bin+key. Returns notfound if the
   * entry does not exist.
   */
  invalidate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('entries', cacheKey(input.bin, input.key)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CacheError, CacheInvalidateOutput>(invalidateNotfound()),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('entries', cacheKey(input.bin, input.key));
                  return invalidateOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  /**
   * Invalidate all cache entries whose tags overlap with the provided tag set.
   * Tags are comma-separated. Returns the count of entries removed.
   */
  invalidateByTags: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('entries'),
        storageError,
      ),
      TE.chain((allEntries) => {
        const targetTags = parseTags(input.tags);
        const toRemove = allEntries.filter((entry) => {
          const entryTags = parseTags((entry.tags as string) ?? '');
          return entryTags.some((et) => targetTags.includes(et));
        });

        return TE.tryCatch(
          async () => {
            for (const entry of toRemove) {
              const key = cacheKey(entry.bin as string, entry.key as string);
              await storage.delete('entries', key);
            }
            return invalidateByTagsOk(toRemove.length);
          },
          storageError,
        );
      }),
    ),
};
