// ============================================================
// EmbeddingCache Handler Tests
//
// File-backed, content-addressed embedding vector cache that
// persists across process restarts.
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { embeddingCacheHandler } from '../handlers/ts/embedding-cache.handler.js';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('EmbeddingCache', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;
  let tmpDir: string;
  let cachePath: string;

  beforeEach(() => {
    storage = createInMemoryStorage();
    tmpDir = join(tmpdir(), `embedding-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    cachePath = join(tmpDir, 'embedding-cache.json');
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // -----------------------------------------------------------------
  // put + lookup (invariant 1: store then retrieve)
  // -----------------------------------------------------------------
  describe('put + lookup', () => {
    it('stores an entry and retrieves it by digest', async () => {
      const putResult = await embeddingCacheHandler.put!({
        digest: 'abc123',
        vector: '[0.1,0.2,0.3]',
        model: 'openai-code',
        dimensions: 3,
        sourceKind: 'concept',
        sourceKey: 'User',
      }, storage);
      expect(putResult.variant).toBe('stored');
      expect(putResult.entry).toBe('abc123');

      const lookupResult = await embeddingCacheHandler.lookup!({
        digest: 'abc123',
      }, storage);
      expect(lookupResult.variant).toBe('hit');
      expect(lookupResult.vector).toBe('[0.1,0.2,0.3]');
      expect(lookupResult.model).toBe('openai-code');
      expect(lookupResult.dimensions).toBe(3);
      expect(lookupResult.sourceKind).toBe('concept');
      expect(lookupResult.sourceKey).toBe('User');
    });

    it('returns miss for unknown digest', async () => {
      const result = await embeddingCacheHandler.lookup!({
        digest: 'nonexistent',
      }, storage);
      expect(result.variant).toBe('miss');
    });
  });

  // -----------------------------------------------------------------
  // put idempotency (invariant 2: duplicate put returns alreadyExists)
  // -----------------------------------------------------------------
  describe('put idempotency', () => {
    it('returns alreadyExists for duplicate digest', async () => {
      await embeddingCacheHandler.put!({
        digest: 'abc123',
        vector: '[0.1,0.2]',
        model: 'codeBERT',
        dimensions: 2,
        sourceKind: 'sync',
        sourceKey: 'AuthSync',
      }, storage);

      const result = await embeddingCacheHandler.put!({
        digest: 'abc123',
        vector: '[0.9,0.8]',
        model: 'codeBERT',
        dimensions: 2,
        sourceKind: 'sync',
        sourceKey: 'AuthSync',
      }, storage);
      expect(result.variant).toBe('alreadyExists');
      expect(result.entry).toBe('abc123');

      // Original vector should be unchanged
      const lookup = await embeddingCacheHandler.lookup!({ digest: 'abc123' }, storage);
      expect(lookup.vector).toBe('[0.1,0.2]');
    });
  });

  // -----------------------------------------------------------------
  // evict (invariant 3: put then evict then lookup = miss)
  // -----------------------------------------------------------------
  describe('evict', () => {
    it('removes an entry so lookup returns miss', async () => {
      await embeddingCacheHandler.put!({
        digest: 'def456',
        vector: '[0.5]',
        model: 'codeBERT',
        dimensions: 1,
        sourceKind: 'widget',
        sourceKey: 'TaskCard',
      }, storage);

      const evictResult = await embeddingCacheHandler.evict!({ digest: 'def456' }, storage);
      expect(evictResult.variant).toBe('ok');

      const lookupResult = await embeddingCacheHandler.lookup!({ digest: 'def456' }, storage);
      expect(lookupResult.variant).toBe('miss');
    });

    it('returns notFound for unknown digest', async () => {
      const result = await embeddingCacheHandler.evict!({ digest: 'nope' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  // -----------------------------------------------------------------
  // flush + warm (file-based persistence round-trip)
  // -----------------------------------------------------------------
  describe('flush + warm', () => {
    it('flushes entries to file and warms from that file', async () => {
      // Put some entries
      await embeddingCacheHandler.put!({
        digest: 'aaa',
        vector: '[0.1,0.2,0.3]',
        model: 'openai-code',
        dimensions: 3,
        sourceKind: 'concept',
        sourceKey: 'User',
      }, storage);
      await embeddingCacheHandler.put!({
        digest: 'bbb',
        vector: '[0.4,0.5]',
        model: 'codeBERT',
        dimensions: 2,
        sourceKind: 'sync',
        sourceKey: 'AuthSync',
      }, storage);

      // Flush to file
      const flushResult = await embeddingCacheHandler.flush!({ path: cachePath }, storage);
      expect(flushResult.variant).toBe('ok');
      expect(flushResult.count).toBe(2);
      expect(existsSync(cachePath)).toBe(true);

      // Verify file is valid JSON with expected schema
      const manifest = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(manifest.version).toBe(1);
      expect(Object.keys(manifest.entries)).toHaveLength(2);
      expect(manifest.entries['aaa'].vector).toBe('[0.1,0.2,0.3]');

      // Warm into a fresh storage
      const freshStorage = createInMemoryStorage();
      const warmResult = await embeddingCacheHandler.warm!({ path: cachePath }, freshStorage);
      expect(warmResult.variant).toBe('ok');
      expect(warmResult.loaded).toBe(2);
      expect(warmResult.skipped).toBe(0);

      // Verify entries are accessible via lookup
      const lookup = await embeddingCacheHandler.lookup!({ digest: 'aaa' }, freshStorage);
      expect(lookup.variant).toBe('hit');
      expect(lookup.vector).toBe('[0.1,0.2,0.3]');
      expect(lookup.model).toBe('openai-code');

      const lookup2 = await embeddingCacheHandler.lookup!({ digest: 'bbb' }, freshStorage);
      expect(lookup2.variant).toBe('hit');
      expect(lookup2.model).toBe('codeBERT');
    });

    it('creates parent directories on flush', async () => {
      const nestedPath = join(tmpDir, 'deep', 'nested', 'cache.json');

      await embeddingCacheHandler.put!({
        digest: 'x',
        vector: '[1.0]',
        model: 'codeBERT',
        dimensions: 1,
        sourceKind: 'concept',
        sourceKey: 'Test',
      }, storage);

      const result = await embeddingCacheHandler.flush!({ path: nestedPath }, storage);
      expect(result.variant).toBe('ok');
      expect(existsSync(nestedPath)).toBe(true);
    });

    it('flushes empty cache without error', async () => {
      const result = await embeddingCacheHandler.flush!({ path: cachePath }, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
    });
  });

  // -----------------------------------------------------------------
  // warm edge cases
  // -----------------------------------------------------------------
  describe('warm edge cases', () => {
    it('returns fileNotFound for missing path', async () => {
      const result = await embeddingCacheHandler.warm!({
        path: join(tmpDir, 'nonexistent.json'),
      }, storage);
      expect(result.variant).toBe('fileNotFound');
    });

    it('returns corrupt for invalid JSON', async () => {
      writeFileSync(cachePath, 'not valid json {{{{');
      const result = await embeddingCacheHandler.warm!({ path: cachePath }, storage);
      expect(result.variant).toBe('corrupt');
    });

    it('returns corrupt for wrong schema version', async () => {
      writeFileSync(cachePath, JSON.stringify({ version: 99, entries: {} }));
      const result = await embeddingCacheHandler.warm!({ path: cachePath }, storage);
      expect(result.variant).toBe('corrupt');
    });

    it('skips entries with invalid vectors', async () => {
      writeFileSync(cachePath, JSON.stringify({
        version: 1,
        manifestDigest: '0',
        entries: {
          good: {
            digest: 'good',
            vector: '[0.1,0.2]',
            model: 'codeBERT',
            dimensions: 2,
            sourceKind: 'concept',
            sourceKey: 'A',
            cachedAt: '2024-01-01T00:00:00Z',
          },
          bad_json: {
            digest: 'bad_json',
            vector: 'not-json',
            model: 'codeBERT',
            dimensions: 2,
            sourceKind: 'concept',
            sourceKey: 'B',
            cachedAt: '2024-01-01T00:00:00Z',
          },
          bad_type: {
            digest: 'bad_type',
            vector: '"a string"',
            model: 'codeBERT',
            dimensions: 2,
            sourceKind: 'concept',
            sourceKey: 'C',
            cachedAt: '2024-01-01T00:00:00Z',
          },
          missing_model: {
            digest: 'missing_model',
            vector: '[0.1]',
            dimensions: 1,
            sourceKind: 'concept',
            sourceKey: 'D',
            cachedAt: '2024-01-01T00:00:00Z',
          },
        },
      }));

      const result = await embeddingCacheHandler.warm!({ path: cachePath }, storage);
      expect(result.variant).toBe('ok');
      expect(result.loaded).toBe(1);  // only 'good' entry
      expect(result.skipped).toBe(3);
    });
  });

  // -----------------------------------------------------------------
  // stats
  // -----------------------------------------------------------------
  describe('stats', () => {
    it('returns aggregate statistics', async () => {
      await embeddingCacheHandler.put!({
        digest: 'a', vector: '[0.1]', model: 'openai-code',
        dimensions: 1, sourceKind: 'concept', sourceKey: 'User',
      }, storage);
      await embeddingCacheHandler.put!({
        digest: 'b', vector: '[0.2]', model: 'codeBERT',
        dimensions: 1, sourceKind: 'sync', sourceKey: 'Auth',
      }, storage);
      await embeddingCacheHandler.put!({
        digest: 'c', vector: '[0.3]', model: 'openai-code',
        dimensions: 1, sourceKind: 'concept', sourceKey: 'Article',
      }, storage);

      const result = await embeddingCacheHandler.stats!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.totalEntries).toBe(3);
      expect(JSON.parse(result.models as string)).toEqual(['codeBERT', 'openai-code']);
      expect(JSON.parse(result.sourceKinds as string)).toEqual(['concept', 'sync']);
    });

    it('returns empty stats for empty cache', async () => {
      const result = await embeddingCacheHandler.stats!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.totalEntries).toBe(0);
      expect(JSON.parse(result.models as string)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------
  // Full persistence round-trip (simulates MCP restart)
  // -----------------------------------------------------------------
  describe('MCP restart simulation', () => {
    it('survives a full warm → put → flush → warm cycle', async () => {
      // Session 1: compute and cache some embeddings
      const s1 = createInMemoryStorage();
      await embeddingCacheHandler.put!({
        digest: 'entity-1', vector: '[0.1,0.2,0.3,0.4]',
        model: 'openai-code', dimensions: 4,
        sourceKind: 'concept', sourceKey: 'User',
      }, s1);
      await embeddingCacheHandler.put!({
        digest: 'entity-2', vector: '[0.5,0.6,0.7,0.8]',
        model: 'openai-code', dimensions: 4,
        sourceKind: 'concept', sourceKey: 'Article',
      }, s1);
      await embeddingCacheHandler.flush!({ path: cachePath }, s1);

      // Session 2: MCP restarts — warm from file
      const s2 = createInMemoryStorage();
      const warmResult = await embeddingCacheHandler.warm!({ path: cachePath }, s2);
      expect(warmResult.variant).toBe('ok');
      expect(warmResult.loaded).toBe(2);

      // Verify both entries survived
      const lookup1 = await embeddingCacheHandler.lookup!({ digest: 'entity-1' }, s2);
      expect(lookup1.variant).toBe('hit');
      expect(lookup1.sourceKey).toBe('User');

      const lookup2 = await embeddingCacheHandler.lookup!({ digest: 'entity-2' }, s2);
      expect(lookup2.variant).toBe('hit');
      expect(lookup2.sourceKey).toBe('Article');

      // Add a new embedding in session 2
      await embeddingCacheHandler.put!({
        digest: 'entity-3', vector: '[0.9,1.0,1.1,1.2]',
        model: 'codeBERT', dimensions: 4,
        sourceKind: 'sync', sourceKey: 'AuthSync',
      }, s2);

      // Flush again
      await embeddingCacheHandler.flush!({ path: cachePath }, s2);

      // Session 3: another restart
      const s3 = createInMemoryStorage();
      const warm3 = await embeddingCacheHandler.warm!({ path: cachePath }, s3);
      expect(warm3.variant).toBe('ok');
      expect(warm3.loaded).toBe(3);

      // All three entries present
      const stats = await embeddingCacheHandler.stats!({}, s3);
      expect(stats.totalEntries).toBe(3);
    });
  });
});
