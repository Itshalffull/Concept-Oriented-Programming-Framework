import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { createHash } from 'crypto';

export const contentStoreHandler: ConceptHandler = {
  async store(input: Record<string, unknown>, storage: ConceptStorage) {
    const content = input.content as string;
    const hash = input.hash as string;

    const existing = await storage.get('blobs', hash);
    if (existing) {
      return { variant: 'exists', blob: hash };
    }

    await storage.put('blobs', hash, {
      hash,
      content,
      size: content.length,
      stored_at: new Date().toISOString(),
    });

    return { variant: 'ok', blob: hash };
  },

  async retrieve(input: Record<string, unknown>, storage: ConceptStorage) {
    const hash = input.hash as string;

    const blob = await storage.get('blobs', hash);
    if (!blob) return { variant: 'notfound' };
    return { variant: 'ok', blob: hash, content: blob.content as string };
  },

  async verify(input: Record<string, unknown>, storage: ConceptStorage) {
    const hash = input.hash as string;

    const blob = await storage.get('blobs', hash);
    if (!blob) return { variant: 'notfound' };

    const actual = `sha256:${createHash('sha256').update(blob.content as string).digest('hex')}`;
    if (actual !== hash) {
      return { variant: 'mismatch', expected: hash, actual };
    }
    return { variant: 'ok' };
  },

  async gc(input: Record<string, unknown>, storage: ConceptStorage) {
    const lockfile_hashes = input.lockfile_hashes as string[];
    const referenced = new Set(lockfile_hashes);

    const allBlobs = await storage.find('blobs');
    let removed = 0;
    for (const blob of allBlobs) {
      const hash = blob.hash as string;
      if (!referenced.has(hash)) {
        await storage.del('blobs', hash);
        removed++;
      }
    }

    return { variant: 'ok', removed };
  },
};
