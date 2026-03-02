// Alias — handler.test.ts
// Unit tests for alias handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { aliasHandler } from './handler.js';
import type { AliasStorage } from './types.js';

const createTestStorage = (): AliasStorage => {
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

const createFailingStorage = (): AliasStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Alias handler', () => {
  describe('addAlias', () => {
    it('adds alias successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('user-123');
          expect(result.right.name).toBe('admin');
        }
      }
    });

    it('returns exists when alias already present', async () => {
      const storage = createTestStorage();
      await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      const result = await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('returns exists with different entity when name is taken', async () => {
      const storage = createTestStorage();
      await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      const result = await aliasHandler.addAlias(
        { entity: 'user-456', name: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
        if (result.right.variant === 'exists') {
          expect(result.right.entity).toBe('user-123');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeAlias', () => {
    it('returns notfound for missing alias', async () => {
      const storage = createTestStorage();
      const result = await aliasHandler.removeAlias(
        { entity: 'user-123', name: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('removes successfully after add', async () => {
      const storage = createTestStorage();
      await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      const result = await aliasHandler.removeAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('user-123');
          expect(result.right.name).toBe('admin');
        }
      }
    });

    it('returns notfound when entity does not own alias', async () => {
      const storage = createTestStorage();
      await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      const result = await aliasHandler.removeAlias(
        { entity: 'user-456', name: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await aliasHandler.removeAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('returns notfound for missing alias', async () => {
      const storage = createTestStorage();
      const result = await aliasHandler.resolve(
        { name: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('resolves entity after add', async () => {
      const storage = createTestStorage();
      await aliasHandler.addAlias(
        { entity: 'user-123', name: 'admin' },
        storage,
      )();
      const result = await aliasHandler.resolve(
        { name: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('user-123');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await aliasHandler.resolve(
        { name: 'admin' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
