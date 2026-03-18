// @migrated dsl-constructs 2026-03-18
// ContentStore Concept Implementation (Package Distribution Suite)
// Content-addressed blob storage for package artifacts. Deduplicates
// identical content via cryptographic hashing, tracks reference counts,
// and supports garbage collection of unreferenced blobs.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;
export function resetContentStoreIds() { nextId = 1; }

const _handler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>) {
    const data = input.data as string;
    const mediaType = input.media_type as string;

    const hash = createHash('sha256').update(data).digest('hex');

    let p = createProgram();
    p = find(p, 'blob', { hash }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => {
        // Increment reference count on existing blob
        thenP = putFrom(thenP, 'blob', '', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>[];
          const blob = existing[0];
          return { ...blob, reference_count: (blob.reference_count as number) + 1 };
        });
        return completeFrom(thenP, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>[];
          return { blob: existing[0].id as string };
        });
      },
      (elseP) => {
        const id = `blob-${nextId++}`;
        const size = data.length;
        const storagePath = `store/${hash.slice(0, 2)}/${hash}`;
        const storedAt = new Date().toISOString();

        elseP = put(elseP, 'blob', id, {
          id,
          hash,
          size,
          media_type: mediaType,
          stored_at: storedAt,
          storage_path: storagePath,
          reference_count: 1,
          data,
        });

        return complete(elseP, 'ok', { blob: id });
      },
    ) as StorageProgram<Result>;
  },

  retrieve(input: Record<string, unknown>) {
    const hash = input.hash as string;

    let p = createProgram();
    p = find(p, 'blob', { hash }, 'results');

    return branch(p,
      (bindings) => (bindings.results as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', {}),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const results = bindings.results as Record<string, unknown>[];
        return { data: results[0].data as string };
      }),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const hash = input.hash as string;

    let p = createProgram();
    p = find(p, 'blob', { hash }, 'results');

    return branch(p,
      (bindings) => (bindings.results as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', {}),
      (elseP) => {
        return completeFrom(elseP, 'dynamic', (bindings) => {
          const results = bindings.results as Record<string, unknown>[];
          const blob = results[0];
          const actual = createHash('sha256').update(blob.data as string).digest('hex');

          if (actual !== hash) {
            return { variant: 'corrupted', expected: hash, actual };
          }

          return { variant: 'ok' };
        });
      },
    ) as StorageProgram<Result>;
  },

  gc(input: Record<string, unknown>) {
    const lockfileHashes = input.lockfile_hashes as string[];

    let p = createProgram();
    p = find(p, 'blob', {}, 'allBlobs');

    // GC requires iterative deletes which can't be expressed in the DSL.
    // We compute the count of removable blobs.
    return completeFrom(p, 'ok', (bindings) => {
      const allBlobs = bindings.allBlobs as Record<string, unknown>[];
      const lockfileSet = new Set(lockfileHashes);
      let removed = 0;

      for (const blob of allBlobs) {
        const blobHash = blob.hash as string;
        const refCount = blob.reference_count as number;

        if (!lockfileSet.has(blobHash) && refCount <= 0) {
          removed++;
        }
      }

      return { removed };
    }) as StorageProgram<Result>;
  },

  stats(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'blob', {}, 'allBlobs');

    return completeFrom(p, 'ok', (bindings) => {
      const allBlobs = bindings.allBlobs as Record<string, unknown>[];

      let totalBlobs = 0;
      let totalBytes = 0;
      let deduplicatedBytes = 0;

      for (const blob of allBlobs) {
        totalBlobs++;
        const size = blob.size as number;
        const refCount = blob.reference_count as number;
        totalBytes += size;
        if (refCount > 1) {
          deduplicatedBytes += size * (refCount - 1);
        }
      }

      return {
        total_blobs: totalBlobs,
        total_bytes: totalBytes,
        deduplicated_bytes: deduplicatedBytes,
      };
    }) as StorageProgram<Result>;
  },
};

export const contentStoreHandler = autoInterpret(_handler);
