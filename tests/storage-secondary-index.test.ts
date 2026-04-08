// ============================================================
// Storage Secondary Index Tests
//
// Validates ensureIndex(), index-aware find(), and index
// maintenance across put/del/delMany operations.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import type { ConceptStorage } from '@clef/runtime';

describe('Storage secondary indexes', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('ensureIndex', () => {
    it('creates an index without error', () => {
      expect(() => storage.ensureIndex!('membership', 'schema')).not.toThrow();
    });

    it('is idempotent (calling twice is safe)', () => {
      storage.ensureIndex!('membership', 'schema');
      expect(() => storage.ensureIndex!('membership', 'schema')).not.toThrow();
    });

    it('can create indexes on multiple fields for the same relation', () => {
      storage.ensureIndex!('items', 'category');
      storage.ensureIndex!('items', 'status');
      expect(() => storage.ensureIndex!('items', 'category')).not.toThrow();
    });
  });

  describe('index-aware find', () => {
    it('find with indexed criteria returns correct results', async () => {
      storage.ensureIndex!('membership', 'schema');
      await storage.put('membership', 'a::Article', { entity_id: 'a', schema: 'Article' });
      await storage.put('membership', 'b::Concept', { entity_id: 'b', schema: 'Concept' });
      await storage.put('membership', 'c::Article', { entity_id: 'c', schema: 'Article' });

      const results = await storage.find('membership', { schema: 'Article' });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.entity_id).sort()).toEqual(['a', 'c']);
    });

    it('find without criteria still returns all (linear scan)', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X' });
      await storage.put('items', '2', { name: 'b', type: 'Y' });
      await storage.put('items', '3', { name: 'c', type: 'X' });

      const results = await storage.find('items');
      expect(results).toHaveLength(3);
    });

    it('find with non-indexed criteria falls back to linear scan', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X', status: 'active' });
      await storage.put('items', '2', { name: 'b', type: 'Y', status: 'inactive' });
      await storage.put('items', '3', { name: 'c', type: 'X', status: 'active' });

      // Search on non-indexed field
      const results = await storage.find('items', { status: 'active' });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name).sort()).toEqual(['a', 'c']);
    });

    it('find with mixed indexed + non-indexed criteria uses index then filters', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X', status: 'active' });
      await storage.put('items', '2', { name: 'b', type: 'X', status: 'inactive' });
      await storage.put('items', '3', { name: 'c', type: 'Y', status: 'active' });
      await storage.put('items', '4', { name: 'd', type: 'X', status: 'active' });

      const results = await storage.find('items', { type: 'X', status: 'active' });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name).sort()).toEqual(['a', 'd']);
    });

    it('find with indexed criteria value not present returns empty', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X' });

      const results = await storage.find('items', { type: 'NonExistent' });
      expect(results).toHaveLength(0);
    });

    it('picks the smallest index when multiple indexed fields are in criteria', async () => {
      storage.ensureIndex!('items', 'category');
      storage.ensureIndex!('items', 'rarity');

      // 100 items in category 'A', but only 2 with rarity 'legendary'
      for (let i = 0; i < 100; i++) {
        await storage.put('items', `item-${i}`, {
          category: 'A',
          rarity: i < 2 ? 'legendary' : 'common',
          value: i,
        });
      }

      const results = await storage.find('items', { category: 'A', rarity: 'legendary' });
      expect(results).toHaveLength(2);
    });
  });

  describe('index maintenance', () => {
    it('put adds entry to index', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X' });

      const results = await storage.find('items', { type: 'X' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('a');
    });

    it('put with changed value updates index correctly', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X' });
      await storage.put('items', '1', { name: 'a', type: 'Y' });

      const oldResults = await storage.find('items', { type: 'X' });
      expect(oldResults).toHaveLength(0);

      const newResults = await storage.find('items', { type: 'Y' });
      expect(newResults).toHaveLength(1);
      expect(newResults[0].name).toBe('a');
    });

    it('del removes entry from index', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X' });
      await storage.put('items', '2', { name: 'b', type: 'X' });

      await storage.del('items', '1');

      const results = await storage.find('items', { type: 'X' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('b');
    });

    it('delMany removes entries from index', async () => {
      storage.ensureIndex!('items', 'type');
      await storage.put('items', '1', { name: 'a', type: 'X' });
      await storage.put('items', '2', { name: 'b', type: 'X' });
      await storage.put('items', '3', { name: 'c', type: 'Y' });

      const deleted = await storage.delMany('items', { type: 'X' });
      expect(deleted).toBe(2);

      const results = await storage.find('items', { type: 'X' });
      expect(results).toHaveLength(0);

      const remaining = await storage.find('items', { type: 'Y' });
      expect(remaining).toHaveLength(1);
    });
  });

  describe('backfill', () => {
    it('ensureIndex on existing data backfills the index', async () => {
      // Put data BEFORE creating index
      await storage.put('membership', 'a::X', { entity_id: 'a', schema: 'X' });
      await storage.put('membership', 'b::Y', { entity_id: 'b', schema: 'Y' });
      await storage.put('membership', 'c::X', { entity_id: 'c', schema: 'X' });

      storage.ensureIndex!('membership', 'schema');

      const results = await storage.find('membership', { schema: 'X' });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.entity_id).sort()).toEqual(['a', 'c']);
    });

    it('backfill handles entries with missing indexed field', async () => {
      await storage.put('items', '1', { name: 'a', type: 'X' });
      await storage.put('items', '2', { name: 'b' }); // no 'type' field

      storage.ensureIndex!('items', 'type');

      const results = await storage.find('items', { type: 'X' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('a');
    });
  });

  describe('FindOptions with index', () => {
    beforeEach(async () => {
      storage.ensureIndex!('items', 'category');
      await storage.put('items', '1', { name: 'a', category: 'fruit', price: 3 });
      await storage.put('items', '2', { name: 'b', category: 'fruit', price: 1 });
      await storage.put('items', '3', { name: 'c', category: 'fruit', price: 2 });
      await storage.put('items', '4', { name: 'd', category: 'veggie', price: 4 });
    });

    it('limit works with indexed find', async () => {
      const results = await storage.find('items', { category: 'fruit' }, { limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('offset works with indexed find', async () => {
      const results = await storage.find('items', { category: 'fruit' }, { offset: 1 });
      expect(results).toHaveLength(2);
    });

    it('sort works with indexed find', async () => {
      const results = await storage.find(
        'items',
        { category: 'fruit' },
        { sort: { field: 'price', order: 'asc' } },
      );
      expect(results).toHaveLength(3);
      expect(results.map(r => r.price)).toEqual([1, 2, 3]);
    });

    it('sort + limit + offset work together with indexed find', async () => {
      const results = await storage.find(
        'items',
        { category: 'fruit' },
        { sort: { field: 'price', order: 'asc' }, offset: 1, limit: 1 },
      );
      expect(results).toHaveLength(1);
      expect(results[0].price).toBe(2);
    });
  });

  describe('performance', () => {
    it('indexed find on 10K entries is fast', async () => {
      storage.ensureIndex!('items', 'category');
      for (let i = 0; i < 10000; i++) {
        await storage.put('items', `item-${i}`, {
          category: i % 10 === 0 ? 'rare' : 'common',
          value: i,
        });
      }

      const start = performance.now();
      const results = await storage.find('items', { category: 'rare' });
      const elapsed = performance.now() - start;

      expect(results).toHaveLength(1000);
      expect(elapsed).toBeLessThan(50); // Index lookup should be very fast
    });
  });
});
