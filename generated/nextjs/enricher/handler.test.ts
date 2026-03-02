// Enricher — handler.test.ts
// Unit tests for enricher handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { enricherHandler } from './handler.js';
import type { EnricherStorage } from './types.js';

const createTestStorage = (): EnricherStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): EnricherStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Seed an item and an enricher definition in storage. */
const seedItemAndEnricher = async (storage: EnricherStorage) => {
  await storage.put('item', 'item-1', { id: 'item-1', title: 'Test Item' });
  await storage.put('enricher', 'enricher-1', {
    id: 'enricher-1',
    fields: ['category', 'tags'],
    confidence: '0.9',
  });
};

describe('Enricher handler', () => {
  describe('enrich', () => {
    it('should enrich an existing item and return ok', async () => {
      const storage = createTestStorage();
      await seedItemAndEnricher(storage);
      const result = await enricherHandler.enrich(
        { itemId: 'item-1', enricherId: 'enricher-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.enrichmentId).toBeTruthy();
          expect(result.right.confidence).toBe('0.9');
        }
      }
    });

    it('should return notfound when item does not exist', async () => {
      const storage = createTestStorage();
      const result = await enricherHandler.enrich(
        { itemId: 'missing', enricherId: 'enricher-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound when enricher does not exist', async () => {
      const storage = createTestStorage();
      await storage.put('item', 'item-1', { id: 'item-1' });
      const result = await enricherHandler.enrich(
        { itemId: 'item-1', enricherId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await enricherHandler.enrich(
        { itemId: 'item-1', enricherId: 'enricher-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('suggest', () => {
    it('should list pending enrichment suggestions', async () => {
      const storage = createTestStorage();
      await seedItemAndEnricher(storage);
      await enricherHandler.enrich({ itemId: 'item-1', enricherId: 'enricher-1' }, storage)();
      const result = await enricherHandler.suggest(
        { itemId: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const suggestions = JSON.parse(result.right.suggestions);
          expect(Array.isArray(suggestions)).toBe(true);
        }
      }
    });

    it('should return notfound when item does not exist', async () => {
      const storage = createTestStorage();
      const result = await enricherHandler.suggest(
        { itemId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('accept', () => {
    it('should accept a pending enrichment', async () => {
      const storage = createTestStorage();
      await seedItemAndEnricher(storage);
      const enrichResult = await enricherHandler.enrich({ itemId: 'item-1', enricherId: 'enricher-1' }, storage)();
      if (E.isRight(enrichResult) && enrichResult.right.variant === 'ok') {
        const result = await enricherHandler.accept(
          { itemId: 'item-1', enrichmentId: enrichResult.right.enrichmentId },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return notfound for nonexistent enrichment', async () => {
      const storage = createTestStorage();
      const result = await enricherHandler.accept(
        { itemId: 'item-1', enrichmentId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('reject', () => {
    it('should reject and delete an enrichment', async () => {
      const storage = createTestStorage();
      await seedItemAndEnricher(storage);
      const enrichResult = await enricherHandler.enrich({ itemId: 'item-1', enricherId: 'enricher-1' }, storage)();
      if (E.isRight(enrichResult) && enrichResult.right.variant === 'ok') {
        const result = await enricherHandler.reject(
          { itemId: 'item-1', enrichmentId: enrichResult.right.enrichmentId },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return notfound for nonexistent enrichment', async () => {
      const storage = createTestStorage();
      const result = await enricherHandler.reject(
        { itemId: 'item-1', enrichmentId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('refreshStale', () => {
    it('should refresh stale enrichments', async () => {
      const storage = createTestStorage();
      // Seed a stale enrichment with old timestamp
      await storage.put('enrichment', 'old-enrichment', {
        enrichmentId: 'old-enrichment',
        itemId: 'item-1',
        enricherId: 'enricher-1',
        createdAt: '2020-01-01T00:00:00.000Z',
        status: 'pending',
      });
      const result = await enricherHandler.refreshStale(
        { olderThan: '2025-01-01T00:00:00.000Z' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.refreshed).toBe(1);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await enricherHandler.refreshStale(
        { olderThan: '2025-01-01T00:00:00.000Z' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
