// Registry — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { registryHandler } from './handler.js';
import type { RegistryStorage } from './types.js';

const createTestStorage = (): RegistryStorage => {
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

const createFailingStorage = (): RegistryStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = registryHandler;

describe('Registry handler', () => {
  describe('register', () => {
    it('should register a concept with namespace/name URI', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { uri: 'core/article', transport: { type: 'http' } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.concept).toBe('article');
        }
      }
    });

    it('should register with default namespace for plain name', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { uri: 'simple-concept', transport: {} },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.concept).toBe('simple-concept');
        }
      }
    });

    it('should return error for empty URI', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { uri: '', transport: {} },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for invalid URI format (trailing slash)', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { uri: 'namespace/', transport: {} },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when URI is already registered', async () => {
      const storage = createTestStorage();
      await handler.register({ uri: 'core/dup', transport: {} }, storage)();

      const result = await handler.register(
        { uri: 'core/dup', transport: {} },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('already registered');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { uri: 'test/concept', transport: {} },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deregister', () => {
    it('should deregister a registered concept', async () => {
      const storage = createTestStorage();
      await handler.register({ uri: 'core/remove-me', transport: {} }, storage)();

      const result = await handler.deregister({ uri: 'core/remove-me' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should not error when deregistering non-existent URI', async () => {
      const storage = createTestStorage();
      const result = await handler.deregister({ uri: 'ghost' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('heartbeat', () => {
    it('should return unavailable for unregistered URI', async () => {
      const storage = createTestStorage();
      const result = await handler.heartbeat({ uri: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.available).toBe(false);
      }
    });

    it('should return available for a recently registered concept', async () => {
      const storage = createTestStorage();
      await handler.register({ uri: 'core/alive', transport: {} }, storage)();

      const result = await handler.heartbeat({ uri: 'core/alive' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.available).toBe(true);
      }
    });
  });
});
