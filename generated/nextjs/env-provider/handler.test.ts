// EnvProvider — handler.test.ts
// Unit tests for envProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { envProviderHandler } from './handler.js';
import type { EnvProviderStorage } from './types.js';

const createTestStorage = (): EnvProviderStorage => {
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

const createFailingStorage = (): EnvProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('EnvProvider handler', () => {
  describe('fetch', () => {
    it('should return ok with cached value from storage', async () => {
      const storage = createTestStorage();
      await storage.put('env_cache', 'MY_VAR', { value: 'cached-value' });
      const result = await envProviderHandler.fetch(
        { name: 'MY_VAR' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('cached-value');
        }
      }
    });

    it('should return ok when variable exists in process.env', async () => {
      const storage = createTestStorage();
      // PATH is almost always set in any environment
      const result = await envProviderHandler.fetch(
        { name: 'PATH' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return variableNotSet for nonexistent variable', async () => {
      const storage = createTestStorage();
      const result = await envProviderHandler.fetch(
        { name: 'DEFINITELY_NOT_SET_ZZZZZ_12345' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('variableNotSet');
        if (result.right.variant === 'variableNotSet') {
          expect(result.right.name).toBe('DEFINITELY_NOT_SET_ZZZZZ_12345');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await envProviderHandler.fetch(
        { name: 'MY_VAR' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
