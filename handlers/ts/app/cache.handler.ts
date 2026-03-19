// @migrated dsl-constructs 2026-03-18
// Cache Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';

const _cacheHandler: FunctionalConceptHandler = {
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
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return { data: entry.data as string };
      }),
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

  invalidateByTags(_input: Record<string, unknown>) {
    // invalidateByTags() requires dynamic iteration and deletion, delegated to imperative override
    let p = createProgram();
    return complete(p, 'ok', { count: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

const _base = autoInterpret(_cacheHandler);

// invalidateByTags() requires dynamic iteration and deletion, use imperative style.
async function _invalidateByTags(input: Record<string, unknown>, storage: ConceptStorage) {
  const tags = input.tags as string;
  const targetTags = tags.split(',').map(t => t.trim()).filter(Boolean);

  const allEntries = await storage.find('cacheEntry', {});
  let count = 0;
  for (const entry of allEntries) {
    const entryTags = Array.isArray(entry.tags) ? entry.tags : [];
    const hasMatch = targetTags.some(t => entryTags.includes(t));
    if (hasMatch) {
      const compositeKey = `${entry.bin}:${entry.key}`;
      await storage.del('cacheEntry', compositeKey);
      count++;
    }
  }
  return { variant: 'ok', count };
}

export const cacheHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'invalidateByTags') return _invalidateByTags;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;

