// ============================================================
// Fetcher Concept Conformance Tests
//
// Download package artifacts from registries and caches. Validates
// fetch, fetchBatch, and cancel actions against the concept spec's
// action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  fetcherHandler,
  resetFetcherIds,
} from '../handlers/ts/fetcher.handler.js';

describe('Fetcher', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  /**
   * The handler simulates downloads by computing sha256 of "${moduleId}@${version}".
   * This helper pre-computes the expected hash for a given module/version pair.
   */
  function expectedHash(moduleId: string, version: string): string {
    return createHash('sha256').update(`${moduleId}@${version}`).digest('hex');
  }

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetFetcherIds();
  });

  describe('fetch', () => {
    it('returns ok when downloading with matching expected hash', async () => {
      const hash = expectedHash('pkg-a', '1.0.0');

      const result = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a-1.0.0.tar.gz',
          expected_hash: hash,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.download).toBe('dl-1');
    });

    it('returns cached when the artifact already exists locally', async () => {
      const hash = expectedHash('pkg-a', '1.0.0');

      // First fetch succeeds
      await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a-1.0.0.tar.gz',
          expected_hash: hash,
        },
        storage,
      );

      // Second fetch returns cached
      const result = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a-1.0.0.tar.gz',
          expected_hash: hash,
        },
        storage,
      );
      expect(result.variant).toBe('cached');
    });

    it('returns integrity_failure when hash does not match', async () => {
      const result = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a-1.0.0.tar.gz',
          expected_hash: 'wrong-hash',
        },
        storage,
      );
      expect(result.variant).toBe('integrity_failure');
      expect(result.expected).toBe('wrong-hash');
      expect(result.actual).toBeDefined();
    });

    it('stores download record with status complete on success', async () => {
      const hash = expectedHash('pkg-b', '2.0.0');

      const result = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-b',
          version: '2.0.0',
          source_url: 'https://registry.example/pkg-b-2.0.0.tar.gz',
          expected_hash: hash,
        },
        storage,
      );

      const download = await storage.get('download', result.download as string);
      expect(download).not.toBeNull();
      expect(download!.status).toBe('complete');
      expect(download!.bytes_downloaded).toBe(download!.bytes_total);
    });
  });

  describe('fetchBatch', () => {
    it('returns ok when all batch items succeed', async () => {
      const result = await fetcherHandler.fetchBatch!(
        {
          items: [
            {
              module_id: 'pkg-a',
              version: '1.0.0',
              source_url: 'https://registry.example/pkg-a.tar.gz',
              expected_hash: expectedHash('pkg-a', '1.0.0'),
            },
            {
              module_id: 'pkg-b',
              version: '2.0.0',
              source_url: 'https://registry.example/pkg-b.tar.gz',
              expected_hash: expectedHash('pkg-b', '2.0.0'),
            },
          ],
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string) as string[];
      expect(results.length).toBe(2);
    });

    it('returns partial when some items fail integrity check', async () => {
      const result = await fetcherHandler.fetchBatch!(
        {
          items: [
            {
              module_id: 'pkg-a',
              version: '1.0.0',
              source_url: 'https://registry.example/pkg-a.tar.gz',
              expected_hash: expectedHash('pkg-a', '1.0.0'),
            },
            {
              module_id: 'pkg-fail',
              version: '1.0.0',
              source_url: 'https://registry.example/pkg-fail.tar.gz',
              expected_hash: 'definitely-wrong-hash',
            },
          ],
        },
        storage,
      );
      expect(result.variant).toBe('partial');
      const completed = JSON.parse(result.completed as string) as string[];
      const failed = JSON.parse(result.failed as string) as string[];
      expect(completed.length).toBe(1);
      expect(failed.length).toBe(1);
    });
  });

  describe('cancel', () => {
    it('returns ok and marks download as cancelled', async () => {
      const hash = expectedHash('pkg-a', '1.0.0');

      const fetchResult = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a.tar.gz',
          expected_hash: hash,
        },
        storage,
      );

      const result = await fetcherHandler.cancel!(
        { download: fetchResult.download },
        storage,
      );
      expect(result.variant).toBe('ok');

      const download = await storage.get('download', fetchResult.download as string);
      expect(download!.status).toBe('cancelled');
      expect(download!.error).toBe('cancelled');
    });
  });

  describe('multi-step sequences', () => {
    it('returns cached on second fetch of same artifact', async () => {
      const hash = expectedHash('pkg-a', '1.0.0');

      const first = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a.tar.gz',
          expected_hash: hash,
        },
        storage,
      );
      expect(first.variant).toBe('ok');

      const second = await fetcherHandler.fetch!(
        {
          module_id: 'pkg-a',
          version: '1.0.0',
          source_url: 'https://registry.example/pkg-a.tar.gz',
          expected_hash: hash,
        },
        storage,
      );
      expect(second.variant).toBe('cached');
    });
  });
});
