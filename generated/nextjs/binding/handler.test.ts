// Binding — handler.test.ts
// Unit tests for binding handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { bindingHandler } from './handler.js';
import type { BindingStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BindingStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): BindingStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Binding handler', () => {
  describe('bind', () => {
    it('should return ok with valid mode', async () => {
      const storage = createTestStorage();

      const result = await bindingHandler.bind(
        { binding: 'my-binding', concept: 'test-concept', mode: 'one-way' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.binding).toBe('my-binding');
        }
      }
    });

    it('should return invalid with unknown mode', async () => {
      const storage = createTestStorage();

      const result = await bindingHandler.bind(
        { binding: 'my-binding', concept: 'test-concept', mode: 'invalid-mode' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingHandler.bind(
        { binding: 'my-binding', concept: 'test-concept', mode: 'one-way' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('sync', () => {
    it('should return ok when binding exists and is active', async () => {
      const storage = createTestStorage();
      await storage.put('binding', 'my-binding', {
        binding: 'my-binding',
        concept: 'test-concept',
        mode: 'one-way',
        state: 'active',
      });

      const result = await bindingHandler.sync(
        { binding: 'my-binding' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.binding).toBe('my-binding');
        }
      }
    });

    it('should return error when binding is not found', async () => {
      const storage = createTestStorage();

      const result = await bindingHandler.sync(
        { binding: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when binding has been unbound', async () => {
      const storage = createTestStorage();
      await storage.put('binding', 'my-binding', {
        binding: 'my-binding',
        state: 'unbound',
      });

      const result = await bindingHandler.sync(
        { binding: 'my-binding' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingHandler.sync(
        { binding: 'my-binding' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invoke', () => {
    it('should return ok when binding exists and is active', async () => {
      const storage = createTestStorage();
      await storage.put('binding', 'my-binding', {
        binding: 'my-binding',
        concept: 'test-concept',
        state: 'active',
      });

      const result = await bindingHandler.invoke(
        { binding: 'my-binding', action: 'doSomething', input: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.binding).toBe('my-binding');
          expect(result.right.result).toBeTruthy();
        }
      }
    });

    it('should return error when binding is not found', async () => {
      const storage = createTestStorage();

      const result = await bindingHandler.invoke(
        { binding: 'nonexistent', action: 'doSomething', input: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when binding is unbound', async () => {
      const storage = createTestStorage();
      await storage.put('binding', 'my-binding', {
        binding: 'my-binding',
        concept: 'test-concept',
        state: 'unbound',
      });

      const result = await bindingHandler.invoke(
        { binding: 'my-binding', action: 'doSomething', input: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingHandler.invoke(
        { binding: 'my-binding', action: 'doSomething', input: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unbind', () => {
    it('should return ok when binding exists', async () => {
      const storage = createTestStorage();
      await storage.put('binding', 'my-binding', {
        binding: 'my-binding',
        concept: 'test-concept',
        state: 'active',
      });

      const result = await bindingHandler.unbind(
        { binding: 'my-binding' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.binding).toBe('my-binding');
        }
      }
    });

    it('should return notfound when binding does not exist', async () => {
      const storage = createTestStorage();

      const result = await bindingHandler.unbind(
        { binding: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingHandler.unbind(
        { binding: 'my-binding' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
