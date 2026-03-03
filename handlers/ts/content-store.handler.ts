// ContentStore Concept Implementation (Package Distribution Suite)
// Content-addressed blob storage for package artifacts. Deduplicates
// identical content via cryptographic hashing, tracks reference counts,
// and supports garbage collection of unreferenced blobs.
import type { ConceptHandler } from '@clef/runtime';
import { createHash } from 'crypto';

let nextId = 1;
export function resetContentStoreIds() { nextId = 1; }

export const contentStoreHandler: ConceptHandler = {
  async store(input, storage) {
    const data = input.data as string;
    const mediaType = input.media_type as string;

    const hash = createHash('sha256').update(data).digest('hex');

    // Check for existing blob with the same hash (deduplication)
    const existing = await storage.find('blob', { hash });
    if (existing.length > 0) {
      const blob = existing[0];
      const refCount = (blob.reference_count as number) + 1;
      await storage.put('blob', blob.id as string, {
        ...blob,
        reference_count: refCount,
      });
      return { variant: 'ok', blob: blob.id as string };
    }

    const id = `blob-${nextId++}`;
    const size = data.length;
    const storagePath = `store/${hash.slice(0, 2)}/${hash}`;
    const storedAt = new Date().toISOString();

    try {
      await storage.put('blob', id, {
        id,
        hash,
        size,
        media_type: mediaType,
        stored_at: storedAt,
        storage_path: storagePath,
        reference_count: 1,
        data,
      });
    } catch {
      return { variant: 'error', message: 'Storage write failed' };
    }

    return { variant: 'ok', blob: id };
  },

  async retrieve(input, storage) {
    const hash = input.hash as string;

    const results = await storage.find('blob', { hash });
    if (results.length === 0) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', data: results[0].data as string };
  },

  async verify(input, storage) {
    const hash = input.hash as string;

    const results = await storage.find('blob', { hash });
    if (results.length === 0) {
      return { variant: 'notfound' };
    }

    const blob = results[0];
    const actual = createHash('sha256').update(blob.data as string).digest('hex');

    if (actual !== hash) {
      return { variant: 'corrupted', expected: hash, actual };
    }

    return { variant: 'ok' };
  },

  async gc(input, storage) {
    const lockfileHashes = input.lockfile_hashes as string[];

    const allBlobs = await storage.find('blob');
    const lockfileSet = new Set(lockfileHashes);
    let removed = 0;

    for (const blob of allBlobs) {
      const blobHash = blob.hash as string;
      const refCount = blob.reference_count as number;

      if (!lockfileSet.has(blobHash) && refCount <= 0) {
        await storage.del('blob', blob.id as string);
        removed++;
      }
    }

    return { variant: 'ok', removed };
  },

  async stats(input, storage) {
    const allBlobs = await storage.find('blob');

    let totalBlobs = 0;
    let totalBytes = 0;
    let deduplicatedBytes = 0;

    for (const blob of allBlobs) {
      totalBlobs++;
      const size = blob.size as number;
      const refCount = blob.reference_count as number;
      totalBytes += size;
      // Bytes saved = size * (refCount - 1) for each deduplicated reference
      if (refCount > 1) {
        deduplicatedBytes += size * (refCount - 1);
      }
    }

    return {
      variant: 'ok',
      total_blobs: totalBlobs,
      total_bytes: totalBytes,
      deduplicated_bytes: deduplicatedBytes,
    };
  },
};
