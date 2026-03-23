// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ContentStore Concept Implementation (Package Distribution Suite)
// Content-addressed blob storage for package artifacts. Deduplicates
// identical content via cryptographic hashing, tracks reference counts,
// and supports garbage collection of unreferenced blobs.
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;
export function resetContentStoreIds() { nextId = 1; }

export const contentStoreHandler: ConceptHandler = {
  async store(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const data = input.data as string;
    const mediaType = input.media_type as string;
    if (!mediaType || mediaType.trim() === '') {
      return { variant: 'error', message: 'media_type is required' };
    }
    const hash = createHash('sha256').update(data).digest('hex');

    const existing = await storage.find('blob', { hash });
    if (existing.length > 0) {
      const blob = existing[0];
      const updated = { ...blob, reference_count: (blob.reference_count as number) + 1 };
      await storage.put('blob', blob.id as string, updated);
      return { variant: 'ok', blob: blob.id as string, hash };
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

    return { variant: 'ok', blob: id, hash };
  },

  async retrieve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;
    // Try lookup by hash first, then by id
    let results = await storage.find('blob', { hash });
    if (results.length === 0) {
      const byId = await storage.get('blob', hash);
      if (byId) results = [byId];
    }
    if (results.length === 0) return { variant: 'notfound' };
    return { variant: 'ok', data: results[0].data as string };
  },

  async verify(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;
    let results = await storage.find('blob', { hash });
    if (results.length === 0) {
      const byId = await storage.get('blob', hash);
      if (byId) results = [byId];
    }
    if (results.length === 0) return { variant: 'notfound' };

    const blob = results[0];
    const actual = createHash('sha256').update(blob.data as string).digest('hex');
    if (actual !== hash) return { variant: 'corrupted', expected: hash, actual };
    return { variant: 'ok' };
  },

  async gc(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const lockfileHashes = input.lockfile_hashes as string[];
    if (!lockfileHashes || !Array.isArray(lockfileHashes) || lockfileHashes.length === 0) {
      return { variant: 'error', message: 'lockfile_hashes must be a non-empty array' };
    }
    const allBlobs = await storage.find('blob', {});
    const lockfileSet = new Set(lockfileHashes);
    let removed = 0;

    for (const blob of allBlobs) {
      const blobHash = blob.hash as string;
      const refCount = blob.reference_count as number;
      if (!lockfileSet.has(blobHash) && refCount <= 0) {
        removed++;
      }
    }

    return { variant: 'ok', removed };
  },

  async stats(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const allBlobs = await storage.find('blob', {});
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

    return { variant: 'ok', total_blobs: totalBlobs, total_bytes: totalBytes, deduplicated_bytes: deduplicatedBytes };
  },
};
