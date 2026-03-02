// Backlink — handler.test.ts
// Unit tests for backlink handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { backlinkHandler } from './handler.js';
import type { BacklinkStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BacklinkStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): BacklinkStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Backlink handler', () => {
  describe('getBacklinks', () => {
    it('should return empty array when no backlinks exist', async () => {
      const storage = createTestStorage();

      const result = await backlinkHandler.getBacklinks(
        { entity: 'page-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.sources).toBe(JSON.stringify([]));
      }
    });

    it('should return sources when backlinks exist', async () => {
      const storage = createTestStorage();
      const sources = JSON.stringify(['page-b', 'page-c']);
      await storage.put('backlinks', 'page-a', { sources });

      const result = await backlinkHandler.getBacklinks(
        { entity: 'page-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.sources).toBe(sources);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await backlinkHandler.getBacklinks(
        { entity: 'page-a' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('getUnlinkedMentions', () => {
    it('should return empty array when no mentions exist', async () => {
      const storage = createTestStorage();

      const result = await backlinkHandler.getUnlinkedMentions(
        { entity: 'page-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.mentions).toBe(JSON.stringify([]));
      }
    });

    it('should return mentions when they exist', async () => {
      const storage = createTestStorage();
      const mentions = JSON.stringify(['doc-1', 'doc-2']);
      await storage.put('mentions', 'page-a', { mentions });

      const result = await backlinkHandler.getUnlinkedMentions(
        { entity: 'page-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.mentions).toBe(mentions);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await backlinkHandler.getUnlinkedMentions(
        { entity: 'page-a' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('reindex', () => {
    it('should return count 0 when no refs exist', async () => {
      const storage = createTestStorage();

      const result = await backlinkHandler.reindex({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(0);
      }
    });

    it('should build reverse index from refs', async () => {
      const storage = createTestStorage();
      await storage.put('refs', 'ref-1', {
        source: 'page-a',
        targets: ['page-b', 'page-c'],
      });
      await storage.put('refs', 'ref-2', {
        source: 'page-d',
        targets: ['page-b'],
      });

      const result = await backlinkHandler.reindex({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(3);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await backlinkHandler.reindex({}, storage)();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
