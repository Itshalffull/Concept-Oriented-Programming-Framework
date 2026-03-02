// NextjsTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { nextjsTargetHandler } from './handler.js';
import type { NextjsTargetStorage } from './types.js';

const createTestStorage = (): NextjsTargetStorage => {
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

const createFailingStorage = (): NextjsTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('NextjsTarget handler', () => {
  describe('generate', () => {
    it('should generate routes from a JSON projection with standard actions', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Post',
        actions: ['list', 'get', 'create', 'update', 'delete'],
      });

      const result = await nextjsTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.routes.length).toBeGreaterThan(0);
          expect(result.right.files.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return ambiguousMapping for unknown actions', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Widget',
        actions: ['teleport'],
      });

      const result = await nextjsTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ambiguousMapping');
        if (result.right.variant === 'ambiguousMapping') {
          expect(result.right.action).toBe('teleport');
        }
      }
    });

    it('should map page actions (view, edit, new) to page routes', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Article',
        actions: ['view', 'edit', 'new'],
      });

      const result = await nextjsTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const pageRoutes = result.right.routes.filter((r) => r.startsWith('PAGE'));
        expect(pageRoutes.length).toBe(3);
      }
    });

    it('should generate default routes for a plain string projection', async () => {
      const storage = createTestStorage();

      const result = await nextjsTargetHandler.generate(
        { projection: 'Comment', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await nextjsTargetHandler.generate(
        { projection: 'Fail', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok for a route with no conflicts', async () => {
      const storage = createTestStorage();

      const result = await nextjsTargetHandler.validate(
        { route: 'GET /posts' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should detect path conflicts after normalization', async () => {
      const storage = createTestStorage();
      // Pre-populate a route
      await storage.put('routes', 'Post:get', {
        concept: 'Post',
        action: 'get',
        kind: 'api',
        method: 'GET',
        route: 'GET /post/[id]',
      });

      const result = await nextjsTargetHandler.validate(
        { route: 'GET /post/[slug]' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pathConflict');
      }
    });
  });

  describe('listRoutes', () => {
    it('should return routes for a given concept', async () => {
      const storage = createTestStorage();
      await storage.put('routes', 'Task:list', {
        concept: 'Task',
        action: 'list',
        route: 'GET /task',
        method: 'GET',
      });

      const result = await nextjsTargetHandler.listRoutes(
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
