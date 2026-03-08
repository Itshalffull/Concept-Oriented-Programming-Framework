// SpatialConnector — handler.test.ts
// fp-ts handler tests for typed connections between spatial items.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { spatialConnectorHandler } from './handler.js';
import type { SpatialConnectorStorage } from './types.js';

const createTestStorage = (): SpatialConnectorStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): SpatialConnectorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('SpatialConnector handler (fp-ts)', () => {
  describe('draw', () => {
    it('creates a connector with ok variant', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'item-1', target: 'item-2', type: 'visual' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).connector).toBeDefined();
      }
    });

    it('creates multiple connectors on same canvas', async () => {
      const storage = createTestStorage();
      const r1 = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const r2 = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'b', target: 'c', type: 'semantic' },
        storage,
      )();
      expect(E.isRight(r1)).toBe(true);
      expect(E.isRight(r2)).toBe(true);
      if (E.isRight(r1) && E.isRight(r2)) {
        expect((r1.right as any).connector).not.toBe((r2.right as any).connector);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('promote', () => {
    it('promotes visual connector to semantic', async () => {
      const storage = createTestStorage();
      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const connectorId = (drawResult as any).right.connector;

      const result = await spatialConnectorHandler.promote(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns already_semantic for semantic connector', async () => {
      const storage = createTestStorage();
      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const connectorId = (drawResult as any).right.connector;
      await spatialConnectorHandler.promote({ connector: connectorId }, storage)();

      const result = await spatialConnectorHandler.promote(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_semantic');
      }
    });

    it('returns error for non-existent connector', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.promote(
        { connector: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      // Returns notfound cast as promote output
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('demote', () => {
    it('demotes semantic connector to visual', async () => {
      const storage = createTestStorage();
      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const connectorId = (drawResult as any).right.connector;
      await spatialConnectorHandler.promote({ connector: connectorId }, storage)();

      const result = await spatialConnectorHandler.demote(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns not_semantic for non-semantic connector', async () => {
      const storage = createTestStorage();
      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const connectorId = (drawResult as any).right.connector;

      const result = await spatialConnectorHandler.demote(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('not_semantic');
      }
    });

    it('returns not_semantic for non-existent connector', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.demote(
        { connector: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('not_semantic');
      }
    });
  });

  describe('surface', () => {
    it('surfaces reference as connector', async () => {
      const storage = createTestStorage();
      // Pre-populate a reference
      await storage.put('reference', 'ref-1', { source: 'a', target: 'b' });

      const result = await spatialConnectorHandler.surface(
        { canvas: 'c1', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns no_reference when reference does not exist', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.surface(
        { canvas: 'c1', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('no_reference');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialConnectorHandler.surface(
        { canvas: 'c1', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('hide', () => {
    it('hides an existing connector', async () => {
      const storage = createTestStorage();
      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const connectorId = (drawResult as any).right.connector;

      const result = await spatialConnectorHandler.hide(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent connector', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.hide(
        { connector: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialConnectorHandler.hide(
        { connector: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('lists connectors for a canvas', async () => {
      const storage = createTestStorage();
      await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();

      const result = await spatialConnectorHandler.list(
        { canvas: 'c1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const items = JSON.parse((result.right as any).connectors);
        expect(items.length).toBeGreaterThan(0);
      }
    });

    it('returns empty list for canvas with no connectors', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.list(
        { canvas: 'empty' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const items = JSON.parse((result.right as any).connectors);
        expect(items).toHaveLength(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialConnectorHandler.list(
        { canvas: 'c1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('deletes an existing connector', async () => {
      const storage = createTestStorage();
      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      const connectorId = (drawResult as any).right.connector;

      const result = await spatialConnectorHandler.delete(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent connector', async () => {
      const storage = createTestStorage();
      const result = await spatialConnectorHandler.delete(
        { connector: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialConnectorHandler.delete(
        { connector: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: draw -> promote -> demote -> delete', () => {
    it('completes full connector lifecycle', async () => {
      const storage = createTestStorage();

      const drawResult = await spatialConnectorHandler.draw(
        { canvas: 'c1', source: 'a', target: 'b', type: 'visual' },
        storage,
      )();
      expect(E.isRight(drawResult)).toBe(true);
      const connectorId = (drawResult as any).right.connector;

      const promoteResult = await spatialConnectorHandler.promote(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(promoteResult)).toBe(true);

      const demoteResult = await spatialConnectorHandler.demote(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(demoteResult)).toBe(true);

      const deleteResult = await spatialConnectorHandler.delete(
        { connector: connectorId },
        storage,
      )();
      expect(E.isRight(deleteResult)).toBe(true);
    });
  });
});
