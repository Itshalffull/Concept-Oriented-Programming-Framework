// Cache — handler.test.ts
// Unit tests for cache handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { cacheHandler } from './handler.js';
import type { CacheStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CacheStorage => {
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
const createFailingStorage = (): CacheStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Cache handler', () => {
  describe('set', () => {
    it('should return ok after storing data', async () => {
      const storage = createTestStorage();

      const result = await cacheHandler.set(
        { bin: 'default', key: 'user-1', data: '{"name":"test"}', tags: 'user,profile', maxAge: 300 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cacheHandler.set(
        { bin: 'default', key: 'user-1', data: '{}', tags: '', maxAge: 300 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return ok with data when entry exists and is not expired', async () => {
      const storage = createTestStorage();
      await storage.put('entries', 'default::user-1', {
        bin: 'default',
        key: 'user-1',
        data: '{"name":"test"}',
        tags: 'user',
        maxAge: 300,
        createdAt: Date.now(),
      });

      const result = await cacheHandler.get(
        { bin: 'default', key: 'user-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.data).toBe('{"name":"test"}');
        }
      }
    });

    it('should return miss when entry does not exist', async () => {
      const storage = createTestStorage();

      const result = await cacheHandler.get(
        { bin: 'default', key: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('miss');
      }
    });

    it('should return miss when entry is expired', async () => {
      const storage = createTestStorage();
      await storage.put('entries', 'default::user-1', {
        bin: 'default',
        key: 'user-1',
        data: '{"name":"test"}',
        tags: 'user',
        maxAge: 1,
        createdAt: Date.now() - 5000,
      });

      const result = await cacheHandler.get(
        { bin: 'default', key: 'user-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('miss');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cacheHandler.get(
        { bin: 'default', key: 'user-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should return ok when entry exists', async () => {
      const storage = createTestStorage();
      await storage.put('entries', 'default::user-1', {
        bin: 'default',
        key: 'user-1',
        data: '{}',
      });

      const result = await cacheHandler.invalidate(
        { bin: 'default', key: 'user-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when entry does not exist', async () => {
      const storage = createTestStorage();

      const result = await cacheHandler.invalidate(
        { bin: 'default', key: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cacheHandler.invalidate(
        { bin: 'default', key: 'user-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidateByTags', () => {
    it('should return ok with count of invalidated entries', async () => {
      const storage = createTestStorage();
      await storage.put('entries', 'default::user-1', {
        bin: 'default',
        key: 'user-1',
        tags: 'user,profile',
      });
      await storage.put('entries', 'default::user-2', {
        bin: 'default',
        key: 'user-2',
        tags: 'user,admin',
      });
      await storage.put('entries', 'default::post-1', {
        bin: 'default',
        key: 'post-1',
        tags: 'post',
      });

      const result = await cacheHandler.invalidateByTags(
        { tags: 'user' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(2);
      }
    });

    it('should return ok with 0 count when no tags match', async () => {
      const storage = createTestStorage();

      const result = await cacheHandler.invalidateByTags(
        { tags: 'nonexistent-tag' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cacheHandler.invalidateByTags(
        { tags: 'user' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
