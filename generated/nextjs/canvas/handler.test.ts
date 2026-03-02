// Canvas — handler.test.ts
// Unit tests for canvas handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { canvasHandler } from './handler.js';
import type { CanvasStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CanvasStorage => {
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
const createFailingStorage = (): CanvasStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Seed a canvas with initial nodes and positions. */
const seedCanvas = async (storage: CanvasStorage, canvasId: string, nodes: string[] = []) => {
  const positions: Record<string, { x: number; y: number; zIndex: number }> = {};
  nodes.forEach((node, i) => {
    positions[node] = { x: i * 100, y: i * 50, zIndex: i + 1 };
  });

  await storage.put('canvas', canvasId, {
    id: canvasId,
    nodes: JSON.stringify(nodes),
    positions: JSON.stringify(positions),
    groups: JSON.stringify({}),
  });
};

describe('Canvas handler', () => {
  describe('addNode', () => {
    it('should return ok when canvas exists', async () => {
      const storage = createTestStorage();
      await seedCanvas(storage, 'canvas-1');

      const result = await canvasHandler.addNode(
        { canvas: 'canvas-1', node: 'node-a', x: 100, y: 200 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when canvas does not exist', async () => {
      const storage = createTestStorage();

      const result = await canvasHandler.addNode(
        { canvas: 'nonexistent', node: 'node-a', x: 100, y: 200 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await canvasHandler.addNode(
        { canvas: 'canvas-1', node: 'node-a', x: 100, y: 200 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('moveNode', () => {
    it('should return ok when canvas and node exist', async () => {
      const storage = createTestStorage();
      await seedCanvas(storage, 'canvas-1', ['node-a']);

      const result = await canvasHandler.moveNode(
        { canvas: 'canvas-1', node: 'node-a', x: 300, y: 400 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when canvas does not exist', async () => {
      const storage = createTestStorage();

      const result = await canvasHandler.moveNode(
        { canvas: 'nonexistent', node: 'node-a', x: 300, y: 400 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound when node is not on canvas', async () => {
      const storage = createTestStorage();
      await seedCanvas(storage, 'canvas-1', ['node-a']);

      const result = await canvasHandler.moveNode(
        { canvas: 'canvas-1', node: 'nonexistent-node', x: 300, y: 400 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await canvasHandler.moveNode(
        { canvas: 'canvas-1', node: 'node-a', x: 300, y: 400 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('groupNodes', () => {
    it('should return ok when all nodes exist on canvas', async () => {
      const storage = createTestStorage();
      await seedCanvas(storage, 'canvas-1', ['node-a', 'node-b']);

      const result = await canvasHandler.groupNodes(
        { canvas: 'canvas-1', nodes: 'node-a,node-b', group: 'group-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when canvas does not exist', async () => {
      const storage = createTestStorage();

      const result = await canvasHandler.groupNodes(
        { canvas: 'nonexistent', nodes: 'node-a', group: 'group-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound when some nodes are missing from canvas', async () => {
      const storage = createTestStorage();
      await seedCanvas(storage, 'canvas-1', ['node-a']);

      const result = await canvasHandler.groupNodes(
        { canvas: 'canvas-1', nodes: 'node-a,node-missing', group: 'group-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await canvasHandler.groupNodes(
        { canvas: 'canvas-1', nodes: 'node-a', group: 'group-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
