// Article — handler.test.ts
// Unit tests for article handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { articleHandler } from './handler.js';
import type { ArticleStorage } from './types.js';

const createTestStorage = (): ArticleStorage => {
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

const createFailingStorage = (): ArticleStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Article handler', () => {
  describe('create', () => {
    it('creates successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await articleHandler.create(
        { article: 'art-1', title: 'My First Article', description: 'A test article', body: 'Hello world content', author: 'author-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.article).toBe('art-1');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await articleHandler.create(
        { article: 'art-1', title: 'Title', description: 'Desc', body: 'Body', author: 'author-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('returns notfound for missing article', async () => {
      const storage = createTestStorage();
      const result = await articleHandler.update(
        { article: 'nonexistent', title: 'Updated', description: 'Desc', body: 'Body' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('updates successfully after create', async () => {
      const storage = createTestStorage();
      await articleHandler.create(
        { article: 'art-1', title: 'Original', description: 'Desc', body: 'Body', author: 'author-1' },
        storage,
      )();
      const result = await articleHandler.update(
        { article: 'art-1', title: 'Updated Title', description: 'New desc', body: 'New body content' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.article).toBe('art-1');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await articleHandler.update(
        { article: 'art-1', title: 'Title', description: 'Desc', body: 'Body' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('returns notfound for missing article', async () => {
      const storage = createTestStorage();
      const result = await articleHandler.delete(
        { article: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('deletes successfully after create', async () => {
      const storage = createTestStorage();
      await articleHandler.create(
        { article: 'art-1', title: 'Title', description: 'Desc', body: 'Body', author: 'author-1' },
        storage,
      )();
      const result = await articleHandler.delete(
        { article: 'art-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.article).toBe('art-1');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await articleHandler.delete(
        { article: 'art-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns notfound for missing article', async () => {
      const storage = createTestStorage();
      const result = await articleHandler.get(
        { article: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns article after create', async () => {
      const storage = createTestStorage();
      await articleHandler.create(
        { article: 'art-1', title: 'My Article', description: 'A description', body: 'Some body text', author: 'author-1' },
        storage,
      )();
      const result = await articleHandler.get(
        { article: 'art-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.title).toBe('My Article');
          expect(result.right.slug).toBe('my-article');
          expect(result.right.author).toBe('author-1');
          expect(result.right.body).toBe('Some body text');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await articleHandler.get(
        { article: 'art-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('returns results after creates', async () => {
      const storage = createTestStorage();
      await articleHandler.create(
        { article: 'art-1', title: 'First', description: 'Desc', body: 'Body 1', author: 'author-1' },
        storage,
      )();
      await articleHandler.create(
        { article: 'art-2', title: 'Second', description: 'Desc', body: 'Body 2', author: 'author-2' },
        storage,
      )();
      const result = await articleHandler.list(
        {},
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const articles = JSON.parse(result.right.articles);
        expect(articles.length).toBe(2);
      }
    });

    it('returns empty list when no articles exist', async () => {
      const storage = createTestStorage();
      const result = await articleHandler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const articles = JSON.parse(result.right.articles);
        expect(articles.length).toBe(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await articleHandler.list({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
