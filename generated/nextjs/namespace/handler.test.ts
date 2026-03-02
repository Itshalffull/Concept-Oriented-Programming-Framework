// Namespace — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { namespaceHandler } from './handler.js';
import type { NamespaceStorage } from './types.js';

const createTestStorage = (): NamespaceStorage => {
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

const createFailingStorage = (): NamespaceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = namespaceHandler;

describe('Namespace handler', () => {
  describe('createNamespacedPage', () => {
    it('should create a new namespaced page', async () => {
      const storage = createTestStorage();
      const result = await handler.createNamespacedPage(
        { node: 'Users', path: 'app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when node already exists', async () => {
      const storage = createTestStorage();
      await handler.createNamespacedPage(
        { node: 'Users', path: 'app' },
        storage,
      )();
      const result = await handler.createNamespacedPage(
        { node: 'Users', path: 'app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should create root-level node with empty path', async () => {
      const storage = createTestStorage();
      const result = await handler.createNamespacedPage(
        { node: 'root', path: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.createNamespacedPage(
        { node: 'fail', path: 'app' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getChildren', () => {
    it('should return children of a namespace node', async () => {
      const storage = createTestStorage();
      await handler.createNamespacedPage({ node: 'app', path: '' }, storage)();
      await handler.createNamespacedPage({ node: 'Users', path: 'app' }, storage)();
      const result = await handler.getChildren({ node: 'app' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent node', async () => {
      const storage = createTestStorage();
      const result = await handler.getChildren({ node: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getHierarchy', () => {
    it('should return hierarchy for a nested node', async () => {
      const storage = createTestStorage();
      await handler.createNamespacedPage({ node: 'app', path: '' }, storage)();
      await handler.createNamespacedPage({ node: 'Users', path: 'app' }, storage)();
      const result = await handler.getHierarchy({ node: 'app.Users' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const hierarchy = JSON.parse(result.right.hierarchy);
          expect(hierarchy.node).toBe('app.Users');
          expect(hierarchy.ancestors).toContain('app');
        }
      }
    });

    it('should return notfound for non-existent node', async () => {
      const storage = createTestStorage();
      const result = await handler.getHierarchy({ node: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('move', () => {
    it('should move a namespace node to a new path', async () => {
      const storage = createTestStorage();
      await handler.createNamespacedPage({ node: 'Users', path: 'app' }, storage)();
      const result = await handler.move(
        { node: 'app.Users', newPath: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent node', async () => {
      const storage = createTestStorage();
      const result = await handler.move(
        { node: 'missing', newPath: 'somewhere' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
