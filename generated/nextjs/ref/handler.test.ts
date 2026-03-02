// Ref — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { refHandler } from './handler.js';
import type { RefStorage } from './types.js';

const createTestStorage = (): RefStorage => {
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

const createFailingStorage = (): RefStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = refHandler;
const validHash = 'abcdef1234567890abcdef1234567890abcdef12';
const anotherHash = '1234567890abcdef1234567890abcdef12345678';

describe('Ref handler', () => {
  describe('create', () => {
    it('should create a new ref and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { name: 'feature-branch', hash: validHash },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.ref).toBe('feature-branch');
        }
      }
    });

    it('should return invalidHash for non-hex hash', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { name: 'bad-ref', hash: 'not-a-hex-hash!' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidHash');
      }
    });

    it('should return exists when ref already exists', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'dup', hash: validHash }, storage)();

      const result = await handler.create({ name: 'dup', hash: anotherHash }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should write an initial reflog entry', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'logged', hash: validHash }, storage)();

      const logEntry = await storage.get('reflog', 'logged_0');
      expect(logEntry).not.toBeNull();
      if (logEntry) {
        expect(logEntry.newHash).toBe(validHash);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.create(
        { name: 'test', hash: validHash },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('should return notFound for non-existent ref', async () => {
      const storage = createTestStorage();
      const result = await handler.update(
        { name: 'missing', newHash: anotherHash, expectedOldHash: validHash },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return conflict when expectedOldHash does not match', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'cas-ref', hash: validHash }, storage)();

      const result = await handler.update(
        { name: 'cas-ref', newHash: anotherHash, expectedOldHash: 'wronghash1234' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflict');
        if (result.right.variant === 'conflict') {
          expect(result.right.current).toBe(validHash);
        }
      }
    });

    it('should update the ref when expectedOldHash matches', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'upd-ref', hash: validHash }, storage)();

      const result = await handler.update(
        { name: 'upd-ref', newHash: anotherHash, expectedOldHash: validHash },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Verify hash was updated
      const resolve = await handler.resolve({ name: 'upd-ref' }, storage)();
      expect(E.isRight(resolve)).toBe(true);
      if (E.isRight(resolve) && resolve.right.variant === 'ok') {
        expect(resolve.right.hash).toBe(anotherHash);
      }
    });
  });

  describe('delete', () => {
    it('should return protected for HEAD', async () => {
      const storage = createTestStorage();
      const result = await handler.delete({ name: 'HEAD' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('protected');
      }
    });

    it('should return protected for main', async () => {
      const storage = createTestStorage();
      const result = await handler.delete({ name: 'main' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('protected');
      }
    });

    it('should return notFound for non-existent ref', async () => {
      const storage = createTestStorage();
      const result = await handler.delete({ name: 'ghost' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should delete an existing non-protected ref', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'temp-branch', hash: validHash }, storage)();

      const result = await handler.delete({ name: 'temp-branch' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Confirm it no longer resolves
      const resolve = await handler.resolve({ name: 'temp-branch' }, storage)();
      expect(E.isRight(resolve)).toBe(true);
      if (E.isRight(resolve)) {
        expect(resolve.right.variant).toBe('notFound');
      }
    });
  });

  describe('resolve', () => {
    it('should return notFound for non-existent ref', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve({ name: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should resolve an existing ref to its hash', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'resolve-me', hash: validHash }, storage)();

      const result = await handler.resolve({ name: 'resolve-me' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.hash).toBe(validHash);
        }
      }
    });
  });

  describe('log', () => {
    it('should return notFound for non-existent ref', async () => {
      const storage = createTestStorage();
      const result = await handler.log({ name: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return reflog entries for an existing ref', async () => {
      const storage = createTestStorage();
      await handler.create({ name: 'log-ref', hash: validHash }, storage)();
      await handler.update(
        { name: 'log-ref', newHash: anotherHash, expectedOldHash: validHash },
        storage,
      )();

      const result = await handler.log({ name: 'log-ref' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entries.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });
});
