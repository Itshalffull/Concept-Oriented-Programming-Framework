// NextjsSdkTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { nextjsSdkTargetHandler } from './handler.js';
import type { NextjsSdkTargetStorage } from './types.js';

const createTestStorage = (): NextjsSdkTargetStorage => {
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

const createFailingStorage = (): NextjsSdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('NextjsSdkTarget handler', () => {
  describe('generate', () => {
    it('should generate SDK package from a JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'User',
        actions: ['create', 'get', 'list', 'update', 'delete'],
      });

      const result = await nextjsSdkTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('user');
        expect(result.right.files).toContain('user/hooks.ts');
        expect(result.right.files).toContain('user/actions.ts');
        expect(result.right.files).toContain('user/types.ts');
        expect(result.right.files).toContain('user/index.ts');
      }
    });

    it('should generate default CRUD actions for a plain string projection', async () => {
      const storage = createTestStorage();

      const result = await nextjsSdkTargetHandler.generate(
        { projection: 'Product', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.files.length).toBe(4);
      }
    });

    it('should persist hooks with correct query/mutation classification', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Task',
        actions: ['get', 'create'],
      });

      const result = await nextjsSdkTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      const getHook = await storage.get('hooks', 'useGetTask');
      expect(getHook).not.toBeNull();
      expect(getHook!.kind).toBe('query');

      const createHook = await storage.get('hooks', 'useCreateTask');
      expect(createHook).not.toBeNull();
      expect(createHook!.kind).toBe('mutation');
    });

    it('should persist server action names', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Order',
        actions: ['create'],
      });

      const result = await nextjsSdkTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      const action = await storage.get('server-actions', 'createOrderAction');
      expect(action).not.toBeNull();
      expect(action!.action).toBe('create');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await nextjsSdkTargetHandler.generate(
        { projection: 'Fail', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
