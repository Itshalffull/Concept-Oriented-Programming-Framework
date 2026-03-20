// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Cache Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, traverse,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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
    return complete(p, 'ok', {}) as StorageProgram<Result>;
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
    return p as StorageProgram<Result>;
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
    return p as StorageProgram<Result>;
  },

  invalidateByTags(input: Record<string, unknown>) {
    const tags = input.tags as string;
    const targetTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    let p = createProgram();
    p = find(p, 'cacheEntry', {}, 'allEntries');

    p = traverse(p, 'allEntries', '_entry', (item) => {
      const entry = item as Record<string, unknown>;
      const entryTags = Array.isArray(entry.tags) ? entry.tags : [];
      const hasMatch = targetTags.some(t => entryTags.includes(t));

      let sub = createProgram();
      if (hasMatch) {
        const compositeKey = `${entry.bin}:${entry.key}`;
        sub = del(sub, 'cacheEntry', compositeKey);
        return complete(sub, 'deleted', {});
      }
      return complete(sub, 'skipped', {});
    }, '_traverseResults');

    return completeFrom(p, 'ok', (bindings) => {
      const results = (bindings._traverseResults || []) as Array<Record<string, unknown>>;
      const count = results.filter(r => r.variant === 'deleted').length;
      return { count };
    }) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const cacheHandler = autoInterpret(_cacheHandler);
