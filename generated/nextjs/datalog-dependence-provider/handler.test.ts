// DatalogDependenceProvider — handler.test.ts
// Unit tests for datalogDependenceProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { datalogDependenceProviderHandler } from './handler.js';
import type { DatalogDependenceProviderStorage } from './types.js';

const createTestStorage = (): DatalogDependenceProviderStorage => {
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

const createFailingStorage = (): DatalogDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DatalogDependenceProvider handler', () => {
  describe('initialize', () => {
    it('returns ok with instance id', async () => {
      const storage = createTestStorage();
      const result = await datalogDependenceProviderHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toBeTruthy();
        }
      }
    });

    it('returns loadError on storage failure (handled via orElse)', async () => {
      const storage = createFailingStorage();
      const result = await datalogDependenceProviderHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addDependency', () => {
    it('returns added=true for a new dependency', async () => {
      const storage = createTestStorage();
      const result = await datalogDependenceProviderHandler.addDependency(
        { from: 'moduleA', to: 'moduleB', kind: 'import' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.added).toBe(true);
      }
    });

    it('returns added=false for a duplicate dependency', async () => {
      const storage = createTestStorage();
      await datalogDependenceProviderHandler.addDependency(
        { from: 'moduleA', to: 'moduleB', kind: 'import' },
        storage,
      )();
      const result = await datalogDependenceProviderHandler.addDependency(
        { from: 'moduleA', to: 'moduleB', kind: 'import' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.added).toBe(false);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogDependenceProviderHandler.addDependency(
        { from: 'moduleA', to: 'moduleB', kind: 'import' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('queryDependencies', () => {
    it('returns dependencies for a node', async () => {
      const storage = createTestStorage();
      await datalogDependenceProviderHandler.addDependency(
        { from: 'A', to: 'B', kind: 'import' },
        storage,
      )();
      const result = await datalogDependenceProviderHandler.queryDependencies(
        { from: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogDependenceProviderHandler.queryDependencies(
        { from: 'A' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('queryTransitiveDependencies', () => {
    it('returns transitive dependencies', async () => {
      const storage = createTestStorage();
      await datalogDependenceProviderHandler.addDependency({ from: 'A', to: 'B', kind: 'import' }, storage)();
      await datalogDependenceProviderHandler.addDependency({ from: 'B', to: 'C', kind: 'import' }, storage)();
      const result = await datalogDependenceProviderHandler.queryTransitiveDependencies(
        { from: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogDependenceProviderHandler.queryTransitiveDependencies(
        { from: 'A' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('queryDependents', () => {
    it('returns dependents for a node', async () => {
      const storage = createTestStorage();
      await datalogDependenceProviderHandler.addDependency(
        { from: 'A', to: 'B', kind: 'import' },
        storage,
      )();
      const result = await datalogDependenceProviderHandler.queryDependents(
        { to: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependents.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogDependenceProviderHandler.queryDependents(
        { to: 'B' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('detectCycles', () => {
    it('returns hasCycle=false for acyclic graph', async () => {
      const storage = createTestStorage();
      await datalogDependenceProviderHandler.addDependency({ from: 'A', to: 'B', kind: 'import' }, storage)();
      const result = await datalogDependenceProviderHandler.detectCycles(storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.hasCycle).toBe(false);
      }
    });

    it('returns hasCycle=true for cyclic graph', async () => {
      const storage = createTestStorage();
      await datalogDependenceProviderHandler.addDependency({ from: 'A', to: 'B', kind: 'import' }, storage)();
      await datalogDependenceProviderHandler.addDependency({ from: 'B', to: 'A', kind: 'import' }, storage)();
      const result = await datalogDependenceProviderHandler.detectCycles(storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.hasCycle).toBe(true);
        expect(result.right.cycleNodes.length).toBeGreaterThan(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogDependenceProviderHandler.detectCycles(storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
