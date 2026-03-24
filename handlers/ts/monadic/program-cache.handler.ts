// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, delMany, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * ProgramCache — functional handler.
 *
 * Builds StoragePrograms for cache lookup, store, invalidation, and stats.
 * Cache key is `${programHash}::${stateHash}`.
 */
const _handler: FunctionalConceptHandler = {
  lookup(input: Record<string, unknown>) {
    if (!input.programHash || (typeof input.programHash === 'string' && (input.programHash as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'programHash is required' }) as StorageProgram<Result>;
    }
    const programHash = input.programHash as string;
    const stateHash = input.stateHash as string;
    const cacheKey = `${programHash}::${stateHash}`;

    let p = createProgram();
    p = get(p, 'entries', cacheKey, 'entry');
    return branch(p, 'entry',
      (b) => complete(b, 'hit', { entry: cacheKey }),
      (b) => complete(b, 'miss', {}),
    ) as StorageProgram<Result>;
  },

  store(input: Record<string, unknown>) {
    if (!input.result || (typeof input.result === 'string' && (input.result as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'result is required' }) as StorageProgram<Result>;
    }
    const programHash = input.programHash as string;
    const stateHash = input.stateHash as string;
    const result = input.result as string;
    const cacheKey = `${programHash}::${stateHash}`;

    let p = createProgram();
    p = get(p, 'entries', cacheKey, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'ok', { entry: cacheKey }),
      (b) => {
        let b2 = put(b, 'entries', cacheKey, {
          programHash, stateHash, result, hits: 0, storedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { entry: cacheKey });
      },
    ) as StorageProgram<Result>;
  },

  invalidateByState(input: Record<string, unknown>) {
    if (!input.stateHash || (typeof input.stateHash === 'string' && (input.stateHash as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stateHash is required' }) as StorageProgram<Result>;
    }
    const stateHash = input.stateHash as string;
    let p = createProgram();
    p = find(p, 'entries', { stateHash }, 'matching');
    return branch(p,
      (bindings) => (bindings.matching as unknown[]).length > 0,
      (b) => {
        let b2 = delMany(b, 'entries', { stateHash }, 'evictedCount');
        return complete(b2, 'ok', { evicted: (b2 as any).evictedCount ?? 0 });
      },
      (b) => complete(b, 'notfound', { message: 'No entries found for stateHash' }),
    ) as StorageProgram<Result>;
  },

  invalidateByProgram(input: Record<string, unknown>) {
    if (!input.programHash || (typeof input.programHash === 'string' && (input.programHash as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'programHash is required' }) as StorageProgram<Result>;
    }
    const programHash = input.programHash as string;
    let p = createProgram();
    p = find(p, 'entries', { programHash }, 'matching');
    return branch(p,
      (bindings) => (bindings.matching as unknown[]).length > 0,
      (b) => {
        let b2 = delMany(b, 'entries', { programHash }, 'evictedCount');
        return complete(b2, 'ok', { evicted: 0 });
      },
      (b) => complete(b, 'notfound', { message: 'No entries found for programHash' }),
    ) as StorageProgram<Result>;
  },

  stats(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entries', {}, 'allEntries');
    return completeFrom(p, 'ok', (bindings) => {
      const entries = bindings.allEntries as Record<string, unknown>[];
      const totalEntries = entries.length;
      const totalHits = entries.reduce((sum, e) => sum + ((e.hits as number) || 0), 0);
      return { totalEntries, hitRate: totalEntries > 0 ? totalHits / totalEntries : 0, memoryBytes: 0 };
    }) as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'ProgramCache' });
    return p as StorageProgram<Result>;
  },
};

export const programCacheHandler = autoInterpret(_handler);
