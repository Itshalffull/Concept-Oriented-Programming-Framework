// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, pure, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

/**
 * ProgramCache — functional handler.
 *
 * Builds StoragePrograms for cache lookup, store, invalidation, and stats.
 * Cache key is `${programHash}::${stateHash}`.
 */
export const programCacheHandler: FunctionalConceptHandler = {
  lookup(input: Record<string, unknown>) {
    const programHash = input.programHash as string;
    const stateHash = input.stateHash as string;
    const cacheKey = `${programHash}::${stateHash}`;

    let p = createProgram();
    p = get(p, 'entries', cacheKey, 'entry');
    const miss = pure(createProgram(), { variant: 'miss' });
    // On hit, update the hit counter and return
    const hit = pure(
      put(createProgram(), 'entries', cacheKey, {
        __merge: 'incrementHits',
        programHash, stateHash,
      }),
      { variant: 'hit', entry: cacheKey, result: '__BOUND_FROM_ENTRY__' },
    );
    p = branch(p, (b) => b.entry == null, miss, hit);
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  store(input: Record<string, unknown>) {
    const programHash = input.programHash as string;
    const stateHash = input.stateHash as string;
    const result = input.result as string;
    const cacheKey = `${programHash}::${stateHash}`;

    let p = createProgram();
    p = get(p, 'entries', cacheKey, 'existing');
    const exists = pure(createProgram(), { variant: 'exists' });
    const store = pure(
      put(createProgram(), 'entries', cacheKey, {
        programHash, stateHash, result, hits: 0, storedAt: '__NOW__',
      }),
      { variant: 'ok', entry: cacheKey },
    );
    p = branch(p, (b) => b.existing != null, exists, store);
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invalidateByState(input: Record<string, unknown>) {
    const stateHash = input.stateHash as string;
    // Find all entries matching stateHash, delete them
    let p = createProgram();
    p = find(p, 'entries', { stateHash }, 'matching');
    // The interpreter will need to iterate and delete — we describe the intent
    p = pure(p, { variant: 'ok', evicted: '__COUNT_MATCHING__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invalidateByProgram(input: Record<string, unknown>) {
    const programHash = input.programHash as string;
    let p = createProgram();
    p = find(p, 'entries', { programHash }, 'matching');
    p = pure(p, { variant: 'ok', evicted: '__COUNT_MATCHING__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  stats(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entries', {}, 'allEntries');
    p = pure(p, { variant: 'ok', totalEntries: '__COUNT__', hitRate: '__COMPUTED__', memoryBytes: '__COMPUTED__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
