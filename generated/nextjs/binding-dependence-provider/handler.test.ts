// BindingDependenceProvider — handler.test.ts
// Unit tests for bindingDependenceProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { bindingDependenceProviderHandler } from './handler.js';
import type { BindingDependenceProviderStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BindingDependenceProviderStorage => {
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
const createFailingStorage = (): BindingDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('BindingDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should return ok with an instance id', async () => {
      const storage = createTestStorage();

      const result = await bindingDependenceProviderHandler.initialize(
        {},
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toBeTruthy();
        }
      }
    });

    it('should return loadError on storage failure (handled via orElse)', async () => {
      const storage = createFailingStorage();

      const result = await bindingDependenceProviderHandler.initialize(
        {},
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addBinding', () => {
    it('should add a binding edge and return edge count', async () => {
      const storage = createTestStorage();

      const result = await bindingDependenceProviderHandler.addBinding(
        { widgetName: 'button-1', conceptRef: 'user-profile', fieldPath: 'name', direction: 'read' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgeCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return Right even for empty widgetName (non-null string passes validation)', async () => {
      const storage = createTestStorage();

      // parseBindingDeclaration uses O.fromNullable which only rejects null/undefined,
      // not empty strings — so empty strings pass validation and produce an edge.
      const result = await bindingDependenceProviderHandler.addBinding(
        { widgetName: '', conceptRef: '', fieldPath: '', direction: 'read' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgeCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingDependenceProviderHandler.addBinding(
        { widgetName: 'btn', conceptRef: 'user', fieldPath: 'name', direction: 'read' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getDependencies', () => {
    it('should return dependencies for a widget', async () => {
      const storage = createTestStorage();
      await storage.put('binding_edges', 'btn:user:name', {
        source: 'btn',
        target: 'user',
        bindingKind: 'read',
        fieldPath: 'name',
      });

      const result = await bindingDependenceProviderHandler.getDependencies(
        { widgetName: 'btn' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toContain('user');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingDependenceProviderHandler.getDependencies(
        { widgetName: 'btn' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return transitive dependencies through edges', async () => {
      const storage = createTestStorage();
      await storage.put('binding_edges', 'widget-a:concept-b:field', {
        source: 'widget-a',
        target: 'concept-b',
        bindingKind: 'read',
        fieldPath: 'field',
      });
      await storage.put('binding_edges', 'concept-b:concept-c:field2', {
        source: 'concept-b',
        target: 'concept-c',
        bindingKind: 'read',
        fieldPath: 'field2',
      });

      const result = await bindingDependenceProviderHandler.getTransitiveDependencies(
        { widgetName: 'widget-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toContain('concept-b');
        expect(result.right.dependencies).toContain('concept-c');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingDependenceProviderHandler.getTransitiveDependencies(
        { widgetName: 'widget-a' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getDependents', () => {
    it('should return widgets that depend on a concept', async () => {
      const storage = createTestStorage();
      await storage.put('binding_edges', 'btn:user:name', {
        source: 'btn',
        target: 'user',
        bindingKind: 'read',
        fieldPath: 'name',
      });

      const result = await bindingDependenceProviderHandler.getDependents(
        { conceptRef: 'user' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependents).toContain('btn');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await bindingDependenceProviderHandler.getDependents(
        { conceptRef: 'user' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
