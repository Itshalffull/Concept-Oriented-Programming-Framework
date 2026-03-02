// OpenaiTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { openaiTargetHandler } from './handler.js';
import type { OpenaiTargetStorage } from './types.js';

const createTestStorage = (): OpenaiTargetStorage => {
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

const createFailingStorage = (): OpenaiTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('OpenaiTarget handler', () => {
  describe('generate', () => {
    it('should generate function definitions from a JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'User',
        actions: [
          { name: 'create', description: 'Create a user', parameters: [{ name: 'data', type: 'object', required: true }] },
          { name: 'get', description: 'Get a user by ID', parameters: [{ name: 'id', type: 'string', required: true }] },
        ],
      });

      const result = await openaiTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.functions).toContain('user_create');
          expect(result.right.functions).toContain('user_get');
          expect(result.right.files.length).toBe(1);
        }
      }
    });

    it('should generate default CRUD functions for a plain string projection', async () => {
      const storage = createTestStorage();

      const result = await openaiTargetHandler.generate(
        { projection: 'Product', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.functions.length).toBe(5);
      }
    });

    it('should return tooManyFunctions when exceeding limit', async () => {
      const storage = createTestStorage();
      // Pre-populate storage with many existing functions
      for (let i = 0; i < 127; i++) {
        await storage.put('functions', `fn_${i}`, { functionName: `fn_${i}` });
      }

      const projection = JSON.stringify({
        concept: 'Widget',
        actions: [
          { name: 'a', description: 'a', parameters: [] },
          { name: 'b', description: 'b', parameters: [] },
        ],
      });

      const result = await openaiTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('tooManyFunctions');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await openaiTargetHandler.generate(
        { projection: 'Fail', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok for a function not in storage', async () => {
      const storage = createTestStorage();

      const result = await openaiTargetHandler.validate(
        { function: 'unknown_fn' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return missingDescription for a function without description', async () => {
      const storage = createTestStorage();
      await storage.put('functions', 'user_create', {
        functionName: 'user_create',
        description: '',
      });

      const result = await openaiTargetHandler.validate(
        { function: 'user_create' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('missingDescription');
      }
    });

    it('should return ok for a function with description', async () => {
      const storage = createTestStorage();
      await storage.put('functions', 'user_get', {
        functionName: 'user_get',
        description: 'Get a user',
      });

      const result = await openaiTargetHandler.validate(
        { function: 'user_get' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('listFunctions', () => {
    it('should return functions for a given concept', async () => {
      const storage = createTestStorage();
      await storage.put('functions', 'task_create', {
        concept: 'Task',
        functionName: 'task_create',
      });

      const result = await openaiTargetHandler.listFunctions(
        { concept: 'Task' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
