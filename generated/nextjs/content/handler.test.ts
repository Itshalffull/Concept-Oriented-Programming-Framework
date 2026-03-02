// Content — handler.test.ts
// Unit tests for content handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { contentHandler } from './handler.js';
import type { ContentStorage } from './types.js';

const handler = contentHandler;

const createTestStorage = (): ContentStorage => {
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

const createFailingStorage = (): ContentStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Content handler', () => {
  describe('store', () => {
    it('should store content and return a CID', async () => {
      const storage = createTestStorage();
      const result = await handler.store(
        { data: Buffer.from('hello world'), name: 'test.txt', contentType: 'text/plain' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.cid).toContain('cid:');
          expect(result.right.size).toBe(11);
        }
      }
    });

    it('should return error for empty data', async () => {
      const storage = createTestStorage();
      const result = await handler.store(
        { data: Buffer.from(''), name: 'empty.txt', contentType: 'text/plain' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for empty content type', async () => {
      const storage = createTestStorage();
      const result = await handler.store(
        { data: Buffer.from('hello'), name: 'test.txt', contentType: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should deduplicate identical content', async () => {
      const storage = createTestStorage();
      const data = Buffer.from('dedup-content');
      const result1 = await handler.store(
        { data, name: 'file1.txt', contentType: 'text/plain' },
        storage,
      )();
      const result2 = await handler.store(
        { data, name: 'file2.txt', contentType: 'text/plain' },
        storage,
      )();
      expect(E.isRight(result1)).toBe(true);
      expect(E.isRight(result2)).toBe(true);
      if (E.isRight(result1) && E.isRight(result2) &&
          result1.right.variant === 'ok' && result2.right.variant === 'ok') {
        expect(result1.right.cid).toBe(result2.right.cid);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.store(
        { data: Buffer.from('hello'), name: 'test.txt', contentType: 'text/plain' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('pin', () => {
    it('should pin existing content', async () => {
      const storage = createTestStorage();
      const storeResult = await handler.store(
        { data: Buffer.from('pin-me'), name: 'pin.txt', contentType: 'text/plain' },
        storage,
      )();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.pin({ cid: storeResult.right.cid }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return error when content not found', async () => {
      const storage = createTestStorage();
      const result = await handler.pin({ cid: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.pin({ cid: 'test-cid' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unpin', () => {
    it('should unpin pinned content', async () => {
      const storage = createTestStorage();
      const storeResult = await handler.store(
        { data: Buffer.from('unpin-me'), name: 'unpin.txt', contentType: 'text/plain' },
        storage,
      )();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const cid = storeResult.right.cid;
        await handler.pin({ cid }, storage)();
        const result = await handler.unpin({ cid }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return error when content not found', async () => {
      const storage = createTestStorage();
      const result = await handler.unpin({ cid: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when content is not pinned', async () => {
      const storage = createTestStorage();
      const storeResult = await handler.store(
        { data: Buffer.from('not-pinned'), name: 'np.txt', contentType: 'text/plain' },
        storage,
      )();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.unpin({ cid: storeResult.right.cid }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('error');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.unpin({ cid: 'test-cid' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a CID back to its content', async () => {
      const storage = createTestStorage();
      const storeResult = await handler.store(
        { data: Buffer.from('resolve-me'), name: 'resolve.txt', contentType: 'text/plain' },
        storage,
      )();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.resolve({ cid: storeResult.right.cid }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.contentType).toBe('text/plain');
          }
        }
      }
    });

    it('should return notFound when CID does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve({ cid: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve({ cid: 'test-cid' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
