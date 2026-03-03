// ============================================================
// ContentStore Concept Conformance Tests
//
// Content-addressed blob storage for package artifacts. Validates
// store, retrieve, verify, gc, and stats actions against the
// concept spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  contentStoreHandler,
  resetContentStoreIds,
} from '../handlers/ts/content-store.handler.js';

describe('ContentStore', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetContentStoreIds();
  });

  describe('store', () => {
    it('returns ok when storing new data', async () => {
      const result = await contentStoreHandler.store!(
        { data: 'hello world', media_type: 'application/tar+gzip' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.blob).toBe('blob-1');
    });

    it('returns ok and increments ref count when storing duplicate data', async () => {
      const first = await contentStoreHandler.store!(
        { data: 'hello world', media_type: 'application/tar+gzip' },
        storage,
      );
      const second = await contentStoreHandler.store!(
        { data: 'hello world', media_type: 'application/tar+gzip' },
        storage,
      );

      expect(first.variant).toBe('ok');
      expect(second.variant).toBe('ok');
      // Same blob returned (deduplication)
      expect(second.blob).toBe(first.blob);

      // Reference count should be 2
      const stored = await storage.get('blob', first.blob as string);
      expect(stored!.reference_count).toBe(2);
    });

    it('assigns unique IDs to blobs with different content', async () => {
      const first = await contentStoreHandler.store!(
        { data: 'content-a', media_type: 'text/plain' },
        storage,
      );
      const second = await contentStoreHandler.store!(
        { data: 'content-b', media_type: 'text/plain' },
        storage,
      );
      expect(first.blob).not.toBe(second.blob);
    });
  });

  describe('retrieve', () => {
    it('returns ok with data for a stored blob', async () => {
      const storeResult = await contentStoreHandler.store!(
        { data: 'test payload', media_type: 'text/plain' },
        storage,
      );

      // Get the hash from the stored blob
      const stored = await storage.get('blob', storeResult.blob as string);
      const hash = stored!.hash as string;

      const result = await contentStoreHandler.retrieve!(
        { hash },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.data).toBe('test payload');
    });

    it('returns notfound when hash does not exist', async () => {
      const result = await contentStoreHandler.retrieve!(
        { hash: 'nonexistent-hash' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('verify', () => {
    it('returns ok when stored blob integrity matches', async () => {
      const storeResult = await contentStoreHandler.store!(
        { data: 'verify me', media_type: 'text/plain' },
        storage,
      );

      const stored = await storage.get('blob', storeResult.blob as string);
      const hash = stored!.hash as string;

      const result = await contentStoreHandler.verify!(
        { hash },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns corrupted when stored data does not match its hash', async () => {
      const storeResult = await contentStoreHandler.store!(
        { data: 'original data', media_type: 'text/plain' },
        storage,
      );

      const stored = await storage.get('blob', storeResult.blob as string);
      const originalHash = stored!.hash as string;

      // Corrupt the stored data
      await storage.put('blob', storeResult.blob as string, {
        ...stored,
        data: 'tampered data',
      });

      const result = await contentStoreHandler.verify!(
        { hash: originalHash },
        storage,
      );
      expect(result.variant).toBe('corrupted');
      expect(result.expected).toBe(originalHash);
      expect(result.actual).not.toBe(originalHash);
    });
  });

  describe('gc', () => {
    it('returns ok and removes unreferenced blobs', async () => {
      // Store a blob then manually set its reference_count to 0
      const storeResult = await contentStoreHandler.store!(
        { data: 'garbage', media_type: 'text/plain' },
        storage,
      );

      const stored = await storage.get('blob', storeResult.blob as string);
      await storage.put('blob', storeResult.blob as string, {
        ...stored,
        reference_count: 0,
      });

      const result = await contentStoreHandler.gc!(
        { lockfile_hashes: [] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.removed).toBe(1);
    });

    it('returns ok with zero removed when all blobs are referenced', async () => {
      const storeResult = await contentStoreHandler.store!(
        { data: 'keep me', media_type: 'text/plain' },
        storage,
      );

      const stored = await storage.get('blob', storeResult.blob as string);
      const hash = stored!.hash as string;

      const result = await contentStoreHandler.gc!(
        { lockfile_hashes: [hash] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.removed).toBe(0);
    });
  });

  describe('stats', () => {
    it('returns ok with aggregate storage statistics', async () => {
      await contentStoreHandler.store!(
        { data: 'blob-a', media_type: 'text/plain' },
        storage,
      );
      await contentStoreHandler.store!(
        { data: 'blob-b', media_type: 'text/plain' },
        storage,
      );

      const result = await contentStoreHandler.stats!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.total_blobs).toBe(2);
      expect(result.total_bytes).toBeGreaterThan(0);
    });

    it('returns ok with deduplicated_bytes when blobs are deduplicated', async () => {
      await contentStoreHandler.store!(
        { data: 'same-content', media_type: 'text/plain' },
        storage,
      );
      await contentStoreHandler.store!(
        { data: 'same-content', media_type: 'text/plain' },
        storage,
      );

      const result = await contentStoreHandler.stats!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.total_blobs).toBe(1);
      expect(result.deduplicated_bytes).toBeGreaterThan(0);
    });
  });

  describe('multi-step sequences', () => {
    it('stores then retrieves the same data', async () => {
      const storeResult = await contentStoreHandler.store!(
        { data: 'roundtrip-data', media_type: 'application/tar+gzip' },
        storage,
      );

      const stored = await storage.get('blob', storeResult.blob as string);
      const hash = stored!.hash as string;

      const retrieveResult = await contentStoreHandler.retrieve!(
        { hash },
        storage,
      );
      expect(retrieveResult.variant).toBe('ok');
      expect(retrieveResult.data).toBe('roundtrip-data');
    });

    it('deduplicates when storing the same data twice', async () => {
      const first = await contentStoreHandler.store!(
        { data: 'dedup-test', media_type: 'text/plain' },
        storage,
      );
      const second = await contentStoreHandler.store!(
        { data: 'dedup-test', media_type: 'text/plain' },
        storage,
      );

      expect(first.blob).toBe(second.blob);

      const stats = await contentStoreHandler.stats!({}, storage);
      expect(stats.total_blobs).toBe(1);
      expect(stats.deduplicated_bytes).toBeGreaterThan(0);
    });
  });
});
