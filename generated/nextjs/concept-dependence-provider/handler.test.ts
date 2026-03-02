// ConceptDependenceProvider — handler.test.ts
// Unit tests for conceptDependenceProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { conceptDependenceProviderHandler } from './handler.js';
import type { ConceptDependenceProviderStorage } from './types.js';

const handler = conceptDependenceProviderHandler;

const createTestStorage = (): ConceptDependenceProviderStorage => {
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

const createFailingStorage = (): ConceptDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ConceptDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('cdp-');
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addSpec', () => {
    it('should extract and store dependency edges from a concept spec', async () => {
      const storage = createTestStorage();
      const specBody = JSON.stringify({
        name: 'Article',
        uses: ['Content', 'Author'],
        extends: 'BaseEntity',
      });
      const result = await handler.addSpec({ specBody }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBe(3);
      }
    });

    it('should handle spec with no dependencies', async () => {
      const storage = createTestStorage();
      const specBody = JSON.stringify({ name: 'Standalone' });
      const result = await handler.addSpec({ specBody }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBe(0);
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.addSpec({ specBody: 'not-json' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const specBody = JSON.stringify({ name: 'Article', uses: ['Content'] });
      const result = await handler.addSpec({ specBody }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getDirectDependencies', () => {
    it('should return direct dependencies for a concept', async () => {
      const storage = createTestStorage();
      const specBody = JSON.stringify({ name: 'Article', uses: ['Content', 'Author'] });
      await handler.addSpec({ specBody }, storage)();
      const result = await handler.getDirectDependencies({ concept: 'Article' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toContain('Content');
        expect(result.right.dependencies).toContain('Author');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getDirectDependencies({ concept: 'Article' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return transitive dependencies through the graph', async () => {
      const storage = createTestStorage();
      await handler.addSpec(
        { specBody: JSON.stringify({ name: 'A', uses: ['B'] }) },
        storage,
      )();
      await handler.addSpec(
        { specBody: JSON.stringify({ name: 'B', uses: ['C'] }) },
        storage,
      )();
      const result = await handler.getTransitiveDependencies({ concept: 'A' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toContain('B');
        expect(result.right.dependencies).toContain('C');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getTransitiveDependencies({ concept: 'A' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getTopologicalOrder', () => {
    it('should return a valid topological ordering', async () => {
      const storage = createTestStorage();
      await handler.addSpec(
        { specBody: JSON.stringify({ name: 'A', uses: ['B'] }) },
        storage,
      )();
      await handler.addSpec(
        { specBody: JSON.stringify({ name: 'B', uses: ['C'] }) },
        storage,
      )();
      const result = await handler.getTopologicalOrder(storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.hasCycle).toBe(false);
        expect(result.right.sorted.length).toBeGreaterThan(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getTopologicalOrder(storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('detectCycles', () => {
    it('should detect no cycles in an acyclic graph', async () => {
      const storage = createTestStorage();
      await handler.addSpec(
        { specBody: JSON.stringify({ name: 'A', uses: ['B'] }) },
        storage,
      )();
      const result = await handler.detectCycles(storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.hasCycle).toBe(false);
        expect(result.right.cycleNodes.length).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.detectCycles(storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
