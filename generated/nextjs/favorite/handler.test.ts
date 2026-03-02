// Favorite — handler.test.ts
// Unit tests for favorite handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { favoriteHandler } from './handler.js';
import type { FavoriteStorage } from './types.js';

const createTestStorage = (): FavoriteStorage => {
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

const createFailingStorage = (): FavoriteStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Favorite handler', () => {
  describe('favorite', () => {
    it('should favorite an article for a user', async () => {
      const storage = createTestStorage();
      const result = await favoriteHandler.favorite(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.user).toBe('test-id-1');
        expect(result.right.article).toBe('article-1');
      }
    });

    it('should be idempotent for repeated favorites', async () => {
      const storage = createTestStorage();
      await favoriteHandler.favorite({ user: 'test-id-1', article: 'article-1' }, storage)();
      const result = await favoriteHandler.favorite(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await favoriteHandler.favorite(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unfavorite', () => {
    it('should unfavorite an article for a user', async () => {
      const storage = createTestStorage();
      await favoriteHandler.favorite({ user: 'test-id-1', article: 'article-1' }, storage)();
      const result = await favoriteHandler.unfavorite(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.user).toBe('test-id-1');
        expect(result.right.article).toBe('article-1');
      }
    });

    it('should return ok even when not previously favorited', async () => {
      const storage = createTestStorage();
      const result = await favoriteHandler.unfavorite(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await favoriteHandler.unfavorite(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('isFavorited', () => {
    it('should return true when article is favorited', async () => {
      const storage = createTestStorage();
      await favoriteHandler.favorite({ user: 'test-id-1', article: 'article-1' }, storage)();
      const result = await favoriteHandler.isFavorited(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.favorited).toBe(true);
      }
    });

    it('should return false when article is not favorited', async () => {
      const storage = createTestStorage();
      const result = await favoriteHandler.isFavorited(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.favorited).toBe(false);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await favoriteHandler.isFavorited(
        { user: 'test-id-1', article: 'article-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('count', () => {
    it('should return the number of favorites for an article', async () => {
      const storage = createTestStorage();
      await favoriteHandler.favorite({ user: 'user-1', article: 'article-1' }, storage)();
      await favoriteHandler.favorite({ user: 'user-2', article: 'article-1' }, storage)();
      const result = await favoriteHandler.count(
        { article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(2);
      }
    });

    it('should return 0 for an article with no favorites', async () => {
      const storage = createTestStorage();
      const result = await favoriteHandler.count(
        { article: 'article-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await favoriteHandler.count(
        { article: 'article-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
