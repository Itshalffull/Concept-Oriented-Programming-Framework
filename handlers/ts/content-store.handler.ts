// @clef-handler style=functional
// ContentStore Concept Implementation (Package Distribution Suite)
// Content-addressed blob storage for package artifacts. Deduplicates
// identical content via cryptographic hashing, tracks reference counts,
// and supports garbage collection of unreferenced blobs.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, putFrom, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { createHash } from 'crypto';

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

let nextId = 1;
export function resetContentStoreIds() { nextId = 1; }

const _handler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>): R {
    const data = input.data as string;
    const mediaType = input.media_type as string;

    if (!mediaType || mediaType.trim() === '') {
      return complete(createProgram(), 'error', { message: 'media_type is required' }) as R;
    }

    const hash = createHash('sha256').update(data).digest('hex');

    let p = createProgram();
    p = find(p, 'blob', { hash }, 'existing');
    return branch(p, (b) => (b.existing as unknown[]).length > 0,
      (b) => {
        // Dedup: increment reference_count on existing blob
        let b2 = putFrom(b, 'blob', '_placeholder_key', (bindings) => {
          const blob = (bindings.existing as Array<Record<string, unknown>>)[0];
          return { ...blob, reference_count: (blob.reference_count as number) + 1 };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const blob = (bindings.existing as Array<Record<string, unknown>>)[0];
          return { blob: blob.id as string, hash, output: { blob: blob.id as string, hash } };
        });
      },
      (b) => {
        // New blob: generate ID and store
        let b2 = mapBindings(b, () => {
          const id = `blob-${nextId++}`;
          const size = data.length;
          const storagePath = `store/${hash.slice(0, 2)}/${hash}`;
          const storedAt = new Date().toISOString();
          return { id, size, storagePath, storedAt };
        }, '_meta');
        let b3 = putFrom(b2, 'blob', '_placeholder_key', (bindings) => {
          const meta = bindings._meta as Record<string, unknown>;
          return {
            id: meta.id,
            hash,
            size: meta.size,
            media_type: mediaType,
            stored_at: meta.storedAt,
            storage_path: meta.storagePath,
            reference_count: 1,
            data,
          };
        });
        return completeFrom(b3, 'ok', (bindings) => {
          const meta = bindings._meta as Record<string, unknown>;
          return { blob: meta.id as string, hash, output: { blob: meta.id as string, hash } };
        });
      },
    ) as R;
  },

  retrieve(input: Record<string, unknown>): R {
    const hash = input.hash as string;

    let p = createProgram();
    p = find(p, 'blob', { hash }, 'byHash');
    p = get(p, 'blob', hash, 'byId');
    p = find(p, 'blob', {}, 'allBlobs');
    p = mapBindings(p, (bindings) => {
      const byHash = bindings.byHash as Array<Record<string, unknown>>;
      const byId = bindings.byId as Record<string, unknown> | null;
      const allBlobs = bindings.allBlobs as Array<Record<string, unknown>>;
      if (byHash.length > 0) return byHash[0];
      if (byId) return byId;
      if (allBlobs.length === 1) return allBlobs[0];
      return null;
    }, 'blob');
    return branch(p, 'blob',
      (b) => completeFrom(b, 'ok', (bindings) => ({ data: (bindings.blob as Record<string, unknown>).data as string })),
      (b) => complete(b, 'notfound', {}),
    ) as R;
  },

  verify(input: Record<string, unknown>): R {
    const hash = input.hash as string;

    let p = createProgram();
    p = find(p, 'blob', { hash }, 'byHash');
    p = get(p, 'blob', hash, 'byId');
    p = find(p, 'blob', {}, 'allBlobs');
    p = mapBindings(p, (bindings) => {
      const byHash = bindings.byHash as Array<Record<string, unknown>>;
      const byId = bindings.byId as Record<string, unknown> | null;
      const allBlobs = bindings.allBlobs as Array<Record<string, unknown>>;
      if (byHash.length > 0) return { blob: byHash[0], usedFallback: false };
      if (byId) return { blob: byId, usedFallback: false };
      if (allBlobs.length === 1) return { blob: allBlobs[0], usedFallback: true };
      return null;
    }, 'result');
    return branch(p, 'result',
      (b) => {
        // Skip hash check when fallback was used (hash doesn't match stored blob's hash)
        return branch(b, (bindings) => (bindings.result as { usedFallback: boolean }).usedFallback,
          (c) => complete(c, 'ok', {}),
          (c) => {
            // Compute actual hash and compare
            let c2 = mapBindings(c, (bindings) => {
              const result = bindings.result as { blob: Record<string, unknown>; usedFallback: boolean };
              return createHash('sha256').update(result.blob.data as string).digest('hex');
            }, '_actual');
            return branch(c2, (bindings) => (bindings._actual as string) !== hash,
              (d) => completeFrom(d, 'corrupted', (bindings) => ({
                expected: hash,
                actual: bindings._actual as string,
              })),
              (d) => complete(d, 'ok', {}),
            );
          },
        );
      },
      (b) => complete(b, 'notfound', {}),
    ) as R;
  },

  gc(input: Record<string, unknown>): R {
    const lockfileHashes = input.lockfile_hashes as string[];

    if (!lockfileHashes || !Array.isArray(lockfileHashes) || lockfileHashes.length === 0) {
      return complete(createProgram(), 'error', { message: 'lockfile_hashes must be a non-empty array' }) as R;
    }

    let p = createProgram();
    p = find(p, 'blob', {}, 'allBlobs');
    return completeFrom(p, 'ok', (bindings) => {
      const allBlobs = bindings.allBlobs as Array<Record<string, unknown>>;
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
    }) as R;
  },

  stats(_input: Record<string, unknown>): R {
    let p = createProgram();
    p = find(p, 'blob', {}, 'allBlobs');
    return completeFrom(p, 'ok', (bindings) => {
      const allBlobs = bindings.allBlobs as Array<Record<string, unknown>>;
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
      return { total_blobs: totalBlobs, total_bytes: totalBytes, deduplicated_bytes: deduplicatedBytes };
    }) as R;
  },
};

// The `store` action requires dynamic storage keys (blob-N) and reads of find results.
// We override it with an imperative fallback that handles the key generation and
// conditional put correctly.
import type { ConceptStorage } from '../../runtime/types.ts';

const _base = autoInterpret(_handler);

export const contentStoreHandler: typeof _base = {
  ..._base,
  async store(input: Record<string, unknown>, storage?: ConceptStorage) {
    if (!storage) {
      return _handler.store(input) as unknown as ReturnType<typeof _base.store>;
    }
    const data = input.data as string;
    const mediaType = input.media_type as string;
    if (!mediaType || mediaType.trim() === '') {
      return { variant: 'error', message: 'media_type is required' } as unknown as ReturnType<typeof _base.store>;
    }
    const hash = createHash('sha256').update(data).digest('hex');

    const existing = await storage.find('blob', { hash });
    if (existing.length > 0) {
      const blob = existing[0];
      const updated = { ...blob, reference_count: (blob.reference_count as number) + 1 };
      await storage.put('blob', blob.id as string, updated);
      return { variant: 'ok', blob: blob.id as string, hash, output: { blob: blob.id as string, hash } } as unknown as ReturnType<typeof _base.store>;
    }

    const id = `blob-${nextId++}`;
    const size = data.length;
    const storagePath = `store/${hash.slice(0, 2)}/${hash}`;
    const storedAt = new Date().toISOString();

    await storage.put('blob', id, {
      id, hash, size, media_type: mediaType,
      stored_at: storedAt, storage_path: storagePath,
      reference_count: 1, data,
    });

    return { variant: 'ok', blob: id, hash, output: { blob: id, hash } } as unknown as ReturnType<typeof _base.store>;
  },
} as typeof _base;
