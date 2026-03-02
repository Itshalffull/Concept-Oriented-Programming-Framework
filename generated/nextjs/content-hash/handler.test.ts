// ContentHash — handler.test.ts
// Unit tests for contentHash handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { contentHashHandler } from './handler.js';
import type { ContentHashStorage } from './types.js';

const handler = contentHashHandler;

const createTestStorage = (): ContentHashStorage => {
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

const createFailingStorage = (): ContentHashStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ContentHash handler', () => {
  describe('store', () => {
    it('should store content and return its SHA-256 hash', async () => {
      const storage = createTestStorage();
      const result = await handler.store(
        { content: Buffer.from('hello world') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.hash.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return alreadyExists for duplicate content', async () => {
      const storage = createTestStorage();
      const data = Buffer.from('dedup-test');
      await handler.store({ content: data }, storage)();
      const result = await handler.store({ content: data }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.store(
        { content: Buffer.from('hello') },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('retrieve', () => {
    it('should retrieve stored content by hash', async () => {
      const storage = createTestStorage();
      const storeResult = await handler.store(
        { content: Buffer.from('retrieve-me') },
        storage,
      )();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.retrieve(
          { hash: storeResult.right.hash },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.content.toString()).toBe('retrieve-me');
          }
        }
      }
    });

    it('should return notFound when hash does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.retrieve({ hash: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.retrieve({ hash: 'test-hash' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('verify', () => {
    it('should return valid when content matches stored hash', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('verify-me');
      const storeResult = await handler.store({ content }, storage)();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.verify(
          { hash: storeResult.right.hash, content },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('valid');
        }
      }
    });

    it('should return corrupt when content does not match hash', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('original');
      const storeResult = await handler.store({ content }, storage)();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.verify(
          { hash: storeResult.right.hash, content: Buffer.from('tampered') },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('corrupt');
        }
      }
    });

    it('should return notFound when hash does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.verify(
        { hash: 'nonexistent', content: Buffer.from('test') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.verify(
        { hash: 'test', content: Buffer.from('test') },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete content with no references', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('delete-me');
      const storeResult = await handler.store({ content }, storage)();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        const result = await handler.delete(
          { hash: storeResult.right.hash },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return notFound when hash does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.delete({ hash: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return referenced when content has active references', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('referenced-content');
      const storeResult = await handler.store({ content }, storage)();
      if (E.isRight(storeResult) && storeResult.right.variant === 'ok') {
        // Manually set refCount > 0
        await storage.put('content_object', storeResult.right.hash, {
          hash: storeResult.right.hash,
          content: content.toString('base64'),
          size: content.length,
          algorithm: 'sha256',
          refCount: 2,
        });
        const result = await handler.delete(
          { hash: storeResult.right.hash },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('referenced');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.delete({ hash: 'test-hash' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
