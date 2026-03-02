// SearchIndex — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { searchIndexHandler } from './handler.js';
import type { SearchIndexStorage } from './types.js';

const createTestStorage = (): SearchIndexStorage => {
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

const createFailingStorage = (): SearchIndexStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = searchIndexHandler;

describe('SearchIndex handler', () => {
  describe('createIndex', () => {
    it('should create a new index', async () => {
      const storage = createTestStorage();
      const result = await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.index).toBe('articles');
        }
      }
    });

    it('should return exists when index already created', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      const result = await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.createIndex({ index: 'x', config: '{}' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('indexItem', () => {
    it('should index an item into an existing index', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      const result = await handler.indexItem(
        { index: 'articles', item: 'doc-1', data: 'The quick brown fox jumps over the lazy dog' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when index does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.indexItem(
        { index: 'missing', item: 'doc-1', data: 'hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('removeItem', () => {
    it('should remove an indexed item', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      await handler.indexItem(
        { index: 'articles', item: 'doc-1', data: 'some content here' },
        storage,
      )();
      const result = await handler.removeItem({ index: 'articles', item: 'doc-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when index does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.removeItem({ index: 'missing', item: 'doc-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('search', () => {
    it('should return ranked results using TF-IDF scoring', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      await handler.indexItem(
        { index: 'articles', item: 'doc-1', data: 'rust programming language systems' },
        storage,
      )();
      await handler.indexItem(
        { index: 'articles', item: 'doc-2', data: 'python programming scripting' },
        storage,
      )();
      const result = await handler.search({ index: 'articles', query: 'programming' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const results = JSON.parse(result.right.results);
          expect(results.length).toBe(2);
          expect(results[0].item).toBeTruthy();
          expect(results[0].score).toBeGreaterThan(0);
        }
      }
    });

    it('should return empty results for unmatched query', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      await handler.indexItem(
        { index: 'articles', item: 'doc-1', data: 'hello world' },
        storage,
      )();
      const result = await handler.search({ index: 'articles', query: 'zzzznotfound' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const results = JSON.parse(result.right.results);
          expect(results.length).toBe(0);
        }
      }
    });

    it('should return notfound when index does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.search({ index: 'missing', query: 'test' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should filter stop words from query', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      await handler.indexItem(
        { index: 'articles', item: 'doc-1', data: 'important data here' },
        storage,
      )();
      const result = await handler.search({ index: 'articles', query: 'the and is' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const results = JSON.parse(result.right.results);
        expect(results.length).toBe(0);
      }
    });
  });

  describe('addProcessor', () => {
    it('should add a processor to the pipeline', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      const result = await handler.addProcessor({ index: 'articles', processor: 'lowercase' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when index does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.addProcessor({ index: 'missing', processor: 'lowercase' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('reindex', () => {
    it('should reindex all items in an index', async () => {
      const storage = createTestStorage();
      await handler.createIndex({ index: 'articles', config: '{}' }, storage)();
      await handler.indexItem(
        { index: 'articles', item: 'doc-1', data: 'Hello World programming' },
        storage,
      )();
      const result = await handler.reindex({ index: 'articles' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.count).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should return notfound when index does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.reindex({ index: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
