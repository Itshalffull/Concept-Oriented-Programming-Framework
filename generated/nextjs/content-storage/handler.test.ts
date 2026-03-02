// ContentStorage — handler.test.ts
// Unit tests for contentStorage handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { contentStorageHandler } from './handler.js';
import type { ContentStorageStorage } from './types.js';

const createTestStorage = (): ContentStorageStorage => {
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

const createFailingStorage = (): ContentStorageStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ContentStorage handler', () => {
  describe('save', () => {
    it('saves content and returns ok with record id', async () => {
      const storage = createTestStorage();
      const result = await contentStorageHandler.save(
        { record: 'test-id-1', data: 'hello world' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.record).toBe('test-id-1');
        }
      }
    });

    it('returns error variant when data is empty', async () => {
      const storage = createTestStorage();
      const result = await contentStorageHandler.save(
        { record: 'test-id-1', data: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contentStorageHandler.save(
        { record: 'test-id-1', data: 'hello' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('load', () => {
    it('returns ok with data when record exists', async () => {
      const storage = createTestStorage();
      await contentStorageHandler.save({ record: 'test-id-1', data: 'hello' }, storage)();
      const result = await contentStorageHandler.load({ record: 'test-id-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.record).toBe('test-id-1');
          expect(result.right.data).toBe('hello');
        }
      }
    });

    it('returns notfound when record does not exist', async () => {
      const storage = createTestStorage();
      const result = await contentStorageHandler.load({ record: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contentStorageHandler.load({ record: 'test-id-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('returns ok when record exists and is deleted', async () => {
      const storage = createTestStorage();
      await contentStorageHandler.save({ record: 'test-id-1', data: 'hello' }, storage)();
      const result = await contentStorageHandler.delete({ record: 'test-id-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.record).toBe('test-id-1');
        }
      }
    });

    it('returns notfound when record does not exist', async () => {
      const storage = createTestStorage();
      const result = await contentStorageHandler.delete({ record: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contentStorageHandler.delete({ record: 'test-id-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('query', () => {
    it('returns ok with results', async () => {
      const storage = createTestStorage();
      await contentStorageHandler.save({ record: 'r1', data: 'a' }, storage)();
      await contentStorageHandler.save({ record: 'r2', data: 'b' }, storage)();
      const result = await contentStorageHandler.query({ filter: 'all' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contentStorageHandler.query({ filter: 'all' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('generateSchema', () => {
    it('returns ok with schema when record exists', async () => {
      const storage = createTestStorage();
      await contentStorageHandler.save({ record: 'test-id-1', data: 'hello' }, storage)();
      const result = await contentStorageHandler.generateSchema({ record: 'test-id-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.schema).toBeTruthy();
        }
      }
    });

    it('returns notfound when record does not exist', async () => {
      const storage = createTestStorage();
      const result = await contentStorageHandler.generateSchema({ record: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contentStorageHandler.generateSchema({ record: 'test-id-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
