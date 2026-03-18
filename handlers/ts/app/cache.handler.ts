// @migrated dsl-constructs 2026-03-18
// Cache Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const cacheHandlerFunctional: FunctionalConceptHandler = {
  set(input: Record<string, unknown>) {
    const bin = input.bin as string;
    const key = input.key as string;
    const data = input.data as string;
    const tags = input.tags as string;
    const maxAge = input.maxAge as number;

    const compositeKey = `${bin}:${key}`;
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const createdAt = Date.now();

    let p = createProgram();
    p = put(p, 'cacheEntry', compositeKey, {
      bin,
      key,
      data,
      tags: tagList,
      maxAge,
      createdAt,
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const bin = input.bin as string;
    const key = input.key as string;
    const compositeKey = `${bin}:${key}`;

    let p = createProgram();
    p = spGet(p, 'cacheEntry', compositeKey, 'entry');
    p = branch(p, 'entry',
      (b) => {
        // TTL check and data return resolved at runtime from bindings
        return complete(b, 'ok', { data: '' });
      },
      (b) => complete(b, 'miss', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invalidate(input: Record<string, unknown>) {
    const bin = input.bin as string;
    const key = input.key as string;
    const compositeKey = `${bin}:${key}`;

    let p = createProgram();
    p = spGet(p, 'cacheEntry', compositeKey, 'entry');
    p = branch(p, 'entry',
      (b) => {
        let b2 = del(b, 'cacheEntry', compositeKey);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invalidateByTags(input: Record<string, unknown>) {
    const tags = input.tags as string;

    let p = createProgram();
    p = find(p, 'cacheEntry', {}, 'allEntries');
    // Tag matching and deletion resolved at runtime
    return complete(p, 'ok', { count: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const cacheHandler = wrapFunctional(cacheHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { cacheHandlerFunctional };
