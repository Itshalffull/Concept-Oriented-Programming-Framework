// RestTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { restTargetHandler } from './handler.js';
import type { RestTargetStorage } from './types.js';

const createTestStorage = (): RestTargetStorage => {
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

const createFailingStorage = (): RestTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = restTargetHandler;

describe('RestTarget handler', () => {
  describe('generate', () => {
    it('should generate routes from a JSON projection with known actions', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'User', actions: ['create', 'get', 'list', 'update', 'delete'] });
      const result = await handler.generate({ projection, config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.routes.length).toBeGreaterThan(0);
          expect(result.right.files.length).toBeGreaterThan(0);
        }
      }
    });

    it('should fall back to default actions for plain-string projection', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ projection: 'UserProfile', config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return ambiguousMapping for unknown action verbs', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'Foo', actions: ['frobulate'] });
      const result = await handler.generate({ projection, config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ambiguousMapping');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate({ projection: 'X', config: '{}' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok when no conflict exists', async () => {
      const storage = createTestStorage();
      const result = await handler.validate({ route: 'GET /api/users' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should detect path conflicts with same method and normalized path', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'User', actions: ['get'] });
      await handler.generate({ projection, config: '{}' }, storage)();
      // The generated route is GET /api/user/{id}, add a conflicting one
      await storage.put('routes', 'GET /api/user/{userId}', {
        concept: 'User',
        route: 'GET /api/user/{userId}',
        method: 'GET',
        path: '/api/user/{userId}',
      });
      const result = await handler.validate({ route: 'GET /api/user/{id}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pathConflict');
      }
    });
  });

  describe('listRoutes', () => {
    it('should list routes for a concept after generation', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'Order', actions: ['create', 'list'] });
      await handler.generate({ projection, config: '{}' }, storage)();
      const result = await handler.listRoutes({ concept: 'Order' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return empty routes for unknown concept', async () => {
      const storage = createTestStorage();
      const result = await handler.listRoutes({ concept: 'Unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.routes.length).toBe(0);
      }
    });
  });
});
