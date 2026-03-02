// Graph — handler.test.ts
// Unit tests for graph handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { graphHandler } from './handler.js';
import type { GraphStorage } from './types.js';

const createTestStorage = (): GraphStorage => {
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

const createFailingStorage = (): GraphStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const buildGraph = async (storage: GraphStorage) => {
  await graphHandler.addNode({ graph: 'g1', node: 'A' }, storage)();
  await graphHandler.addNode({ graph: 'g1', node: 'B' }, storage)();
  await graphHandler.addNode({ graph: 'g1', node: 'C' }, storage)();
  await graphHandler.addEdge({ graph: 'g1', source: 'A', target: 'B' }, storage)();
  await graphHandler.addEdge({ graph: 'g1', source: 'B', target: 'C' }, storage)();
};

describe('Graph handler', () => {
  describe('addNode', () => {
    it('should add a node to a graph', async () => {
      const storage = createTestStorage();
      const result = await graphHandler.addNode(
        { graph: 'g1', node: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should auto-create the graph on first use', async () => {
      const storage = createTestStorage();
      const result = await graphHandler.addNode(
        { graph: 'new-graph', node: 'X' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphHandler.addNode(
        { graph: 'g', node: 'n' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeNode', () => {
    it('should remove an existing node', async () => {
      const storage = createTestStorage();
      await buildGraph(storage);
      const result = await graphHandler.removeNode(
        { graph: 'g1', node: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing node', async () => {
      const storage = createTestStorage();
      await graphHandler.addNode({ graph: 'g1', node: 'A' }, storage)();
      const result = await graphHandler.removeNode(
        { graph: 'g1', node: 'Z' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound for missing graph', async () => {
      const storage = createTestStorage();
      const result = await graphHandler.removeNode(
        { graph: 'nonexistent', node: 'A' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphHandler.removeNode(
        { graph: 'g', node: 'n' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addEdge', () => {
    it('should add an edge between existing nodes', async () => {
      const storage = createTestStorage();
      await graphHandler.addNode({ graph: 'g1', node: 'A' }, storage)();
      await graphHandler.addNode({ graph: 'g1', node: 'B' }, storage)();
      const result = await graphHandler.addEdge(
        { graph: 'g1', source: 'A', target: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when source node missing', async () => {
      const storage = createTestStorage();
      await graphHandler.addNode({ graph: 'g1', node: 'B' }, storage)();
      const result = await graphHandler.addEdge(
        { graph: 'g1', source: 'X', target: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should be idempotent for duplicate edges', async () => {
      const storage = createTestStorage();
      await graphHandler.addNode({ graph: 'g1', node: 'A' }, storage)();
      await graphHandler.addNode({ graph: 'g1', node: 'B' }, storage)();
      await graphHandler.addEdge({ graph: 'g1', source: 'A', target: 'B' }, storage)();
      const result = await graphHandler.addEdge(
        { graph: 'g1', source: 'A', target: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphHandler.addEdge(
        { graph: 'g', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeEdge', () => {
    it('should remove an existing edge', async () => {
      const storage = createTestStorage();
      await buildGraph(storage);
      const result = await graphHandler.removeEdge(
        { graph: 'g1', source: 'A', target: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing edge', async () => {
      const storage = createTestStorage();
      await buildGraph(storage);
      const result = await graphHandler.removeEdge(
        { graph: 'g1', source: 'A', target: 'C' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphHandler.removeEdge(
        { graph: 'g', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getNeighbors', () => {
    it('should return direct neighbors at depth 1', async () => {
      const storage = createTestStorage();
      await buildGraph(storage);
      const result = await graphHandler.getNeighbors(
        { graph: 'g1', node: 'A', depth: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const neighbors = JSON.parse(result.right.neighbors);
          expect(neighbors).toContain('B');
        }
      }
    });

    it('should return transitive neighbors at depth 2', async () => {
      const storage = createTestStorage();
      await buildGraph(storage);
      const result = await graphHandler.getNeighbors(
        { graph: 'g1', node: 'A', depth: 2 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const neighbors = JSON.parse(result.right.neighbors);
        expect(neighbors).toContain('B');
        expect(neighbors).toContain('C');
      }
    });

    it('should return notfound for missing node', async () => {
      const storage = createTestStorage();
      await buildGraph(storage);
      const result = await graphHandler.getNeighbors(
        { graph: 'g1', node: 'Z', depth: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphHandler.getNeighbors(
        { graph: 'g', node: 'n', depth: 1 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('filterNodes', () => {
    it('should filter nodes by prefix', async () => {
      const storage = createTestStorage();
      await graphHandler.addNode({ graph: 'g1', node: 'auth-login' }, storage)();
      await graphHandler.addNode({ graph: 'g1', node: 'auth-logout' }, storage)();
      await graphHandler.addNode({ graph: 'g1', node: 'user-profile' }, storage)();
      const result = await graphHandler.filterNodes(
        { graph: 'g1', filter: JSON.stringify({ prefix: 'auth' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const filtered = JSON.parse(result.right.filtered);
        expect(filtered.length).toBe(2);
      }
    });

    it('should filter nodes by pattern regex', async () => {
      const storage = createTestStorage();
      await graphHandler.addNode({ graph: 'g1', node: 'UserAuth' }, storage)();
      await graphHandler.addNode({ graph: 'g1', node: 'UserProfile' }, storage)();
      await graphHandler.addNode({ graph: 'g1', node: 'OrderItem' }, storage)();
      const result = await graphHandler.filterNodes(
        { graph: 'g1', filter: JSON.stringify({ pattern: '^User' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const filtered = JSON.parse(result.right.filtered);
        expect(filtered.length).toBe(2);
      }
    });

    it('should return notfound for missing graph', async () => {
      const storage = createTestStorage();
      const result = await graphHandler.filterNodes(
        { graph: 'nonexistent', filter: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await graphHandler.filterNodes(
        { graph: 'g', filter: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
