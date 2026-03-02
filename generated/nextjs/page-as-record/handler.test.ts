// PageAsRecord — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { pageAsRecordHandler } from './handler.js';
import type { PageAsRecordStorage } from './types.js';

const createTestStorage = (): PageAsRecordStorage => {
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

const createFailingStorage = (): PageAsRecordStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('PageAsRecord handler', () => {
  describe('create', () => {
    it('should create a new page with schema', async () => {
      const storage = createTestStorage();

      const result = await pageAsRecordHandler.create(
        { page: 'page-1', schema: 'blog-post' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.page).toBe('page-1');
        }
      }
    });

    it('should return exists for duplicate page', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'dup', schema: 's' }, storage)();

      const result = await pageAsRecordHandler.create(
        { page: 'dup', schema: 's' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('setProperty', () => {
    it('should set a property on an existing page', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'p1', schema: 'article' }, storage)();

      const result = await pageAsRecordHandler.setProperty(
        { page: 'p1', key: 'title', value: 'Hello' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent page', async () => {
      const storage = createTestStorage();

      const result = await pageAsRecordHandler.setProperty(
        { page: 'missing', key: 'title', value: 'Hello' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return invalid for empty key', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'p2', schema: 's' }, storage)();

      const result = await pageAsRecordHandler.setProperty(
        { page: 'p2', key: '', value: 'val' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('getProperty', () => {
    it('should get a property value from a page', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'pg', schema: 's' }, storage)();
      await pageAsRecordHandler.setProperty({ page: 'pg', key: 'author', value: 'Alice' }, storage)();

      const result = await pageAsRecordHandler.getProperty(
        { page: 'pg', key: 'author' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.value).toBe('Alice');
      }
    });

    it('should return notfound for nonexistent page', async () => {
      const storage = createTestStorage();

      const result = await pageAsRecordHandler.getProperty(
        { page: 'nope', key: 'author' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound for nonexistent property', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'pg2', schema: 's' }, storage)();

      const result = await pageAsRecordHandler.getProperty(
        { page: 'pg2', key: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('appendToBody', () => {
    it('should append content to a page body', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'ap', schema: 's' }, storage)();
      await pageAsRecordHandler.appendToBody({ page: 'ap', content: 'Hello ' }, storage)();
      await pageAsRecordHandler.appendToBody({ page: 'ap', content: 'World' }, storage)();

      const stored = await storage.get('page', 'ap');
      expect(stored!.body).toBe('Hello World');
    });

    it('should return notfound for nonexistent page', async () => {
      const storage = createTestStorage();

      const result = await pageAsRecordHandler.appendToBody(
        { page: 'missing', content: 'text' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('attachToSchema', () => {
    it('should change the schema of an existing page', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'sc', schema: 'old' }, storage)();

      const result = await pageAsRecordHandler.attachToSchema(
        { page: 'sc', schema: 'new-schema' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const stored = await storage.get('page', 'sc');
      expect(stored!.schema).toBe('new-schema');
    });

    it('should return notfound for missing page', async () => {
      const storage = createTestStorage();

      const result = await pageAsRecordHandler.attachToSchema(
        { page: 'gone', schema: 's' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('convertFromFreeform', () => {
    it('should convert a freeform page to structured', async () => {
      const storage = createTestStorage();
      await pageAsRecordHandler.create({ page: 'ff', schema: 'none' }, storage)();

      const result = await pageAsRecordHandler.convertFromFreeform(
        { page: 'ff', schema: 'structured' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const stored = await storage.get('page', 'ff');
      expect(stored!.schema).toBe('structured');
      expect(stored!.convertedAt).toBeDefined();
    });

    it('should return notfound for missing page', async () => {
      const storage = createTestStorage();

      const result = await pageAsRecordHandler.convertFromFreeform(
        { page: 'nope', schema: 's' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('storage errors', () => {
    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await pageAsRecordHandler.create(
        { page: 'fail', schema: 's' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
