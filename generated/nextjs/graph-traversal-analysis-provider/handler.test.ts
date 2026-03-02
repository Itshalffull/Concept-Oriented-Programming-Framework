// GraphTraversalAnalysisProvider — handler.test.ts
// Unit tests for graphTraversalAnalysisProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { graphTraversalAnalysisProviderHandler } from './handler.js';
import type { GraphTraversalAnalysisProviderStorage } from './types.js';

const createTestStorage = (): GraphTraversalAnalysisProviderStorage => {
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

const createFailingStorage = (): GraphTraversalAnalysisProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const buildTestGraph = async (storage: GraphTraversalAnalysisProviderStorage) => {
  await graphTraversalAnalysisProviderHandler.addEdge(
    { from: 'A', to: 'B', label: 'depends' },
    storage,
  )();
  await graphTraversalAnalysisProviderHandler.addEdge(
    { from: 'B', to: 'C', label: 'depends' },
    storage,
  )();
  await graphTraversalAnalysisProviderHandler.addEdge(
    { from: 'A', to: 'C', label: 'depends' },
    storage,
  )();
};

describe('GraphTraversalAnalysisProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await graphTraversalAnalysisProviderHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('gtap-');
        }
      }
    });

    it('should handle storage failure gracefully with loadError', async () => {
      const storage = createFailingStorage();
      const result = await graphTraversalAnalysisProviderHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addEdge', () => {
    it('should add an edge and return the edge count', async () => {
      const storage = createTestStorage();
      const result = await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'A', to: 'B', label: 'depends' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgeCount).toBe(1);
      }
    });

    it('should increment edge count with each addition', async () => {
      const storage = createTestStorage();
      await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'A', to: 'B', label: 'dep' },
        storage,
      )();
      const result = await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'B', to: 'C', label: 'dep' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgeCount).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'A', to: 'B', label: 'dep' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('dfs', () => {
    it('should perform depth-first search and return traversal data', async () => {
      const storage = createTestStorage();
      await buildTestGraph(storage);
      const result = await graphTraversalAnalysisProviderHandler.dfs(
        { start: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.visited).toContain('A');
        expect(result.right.visited).toContain('B');
        expect(result.right.visited).toContain('C');
        expect(result.right.preOrder.length).toBeGreaterThanOrEqual(3);
        expect(result.right.postOrder.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should detect back edges in cycles', async () => {
      const storage = createTestStorage();
      await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'X', to: 'Y', label: 'dep' },
        storage,
      )();
      await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'Y', to: 'X', label: 'back' },
        storage,
      )();
      const result = await graphTraversalAnalysisProviderHandler.dfs(
        { start: 'X' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.backEdges.length).toBeGreaterThan(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphTraversalAnalysisProviderHandler.dfs(
        { start: 'A' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('bfs', () => {
    it('should perform breadth-first search', async () => {
      const storage = createTestStorage();
      await buildTestGraph(storage);
      const result = await graphTraversalAnalysisProviderHandler.bfs(
        { start: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.visited).toContain('A');
        expect(result.right.visited).toContain('B');
        expect(result.right.visited).toContain('C');
        // BFS: A should be first
        expect(result.right.visited[0]).toBe('A');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphTraversalAnalysisProviderHandler.bfs(
        { start: 'A' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('dominatorTree', () => {
    it('should compute dominators for a rooted graph', async () => {
      const storage = createTestStorage();
      await buildTestGraph(storage);
      const result = await graphTraversalAnalysisProviderHandler.dominatorTree(
        { root: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dominators).toBeDefined();
        expect(result.right.dominators['A']).toBe('A');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphTraversalAnalysisProviderHandler.dominatorTree(
        { root: 'A' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('stronglyConnectedComponents', () => {
    it('should find SCCs in a graph', async () => {
      const storage = createTestStorage();
      await buildTestGraph(storage);
      const result = await graphTraversalAnalysisProviderHandler.stronglyConnectedComponents(
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.components.length).toBeGreaterThan(0);
      }
    });

    it('should identify a cycle as a single SCC', async () => {
      const storage = createTestStorage();
      await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'X', to: 'Y', label: 'dep' },
        storage,
      )();
      await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'Y', to: 'Z', label: 'dep' },
        storage,
      )();
      await graphTraversalAnalysisProviderHandler.addEdge(
        { from: 'Z', to: 'X', label: 'dep' },
        storage,
      )();
      const result = await graphTraversalAnalysisProviderHandler.stronglyConnectedComponents(
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const cyclicScc = result.right.components.find((c) => c.length === 3);
        expect(cyclicScc).toBeDefined();
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphTraversalAnalysisProviderHandler.stronglyConnectedComponents(
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
