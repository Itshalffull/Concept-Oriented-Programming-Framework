// Frame — handler.test.ts
// fp-ts handler tests for named spatial regions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { frameHandler } from './handler.js';
import type { FrameStorage } from './types.js';

const createTestStorage = (): FrameStorage => {
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

const createFailingStorage = (): FrameStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Frame handler (fp-ts)', () => {
  describe('create', () => {
    it('creates a frame with ok variant', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.create(
        { canvas: 'c1', name: 'Header', x: 0, y: 0, width: 200, height: 100 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).frame).toBeDefined();
      }
    });

    it('creates multiple frames on same canvas', async () => {
      const storage = createTestStorage();
      const r1 = await frameHandler.create(
        { canvas: 'c1', name: 'A', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const r2 = await frameHandler.create(
        { canvas: 'c1', name: 'B', x: 200, y: 0, width: 100, height: 100 },
        storage,
      )();
      expect(E.isRight(r1)).toBe(true);
      expect(E.isRight(r2)).toBe(true);
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.create(
        { canvas: 'c1', name: 'X', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resize', () => {
    it('resizes an existing frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'F', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;

      const result = await frameHandler.resize(
        { frame: frameId, width: 300, height: 200 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent frame', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.resize(
        { frame: 'nonexistent', width: 300, height: 200 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.resize(
        { frame: 'test', width: 100, height: 100 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rename', () => {
    it('renames an existing frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'Old', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;

      const result = await frameHandler.rename(
        { frame: frameId, name: 'New' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent frame', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.rename(
        { frame: 'nonexistent', name: 'New' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.rename(
        { frame: 'test', name: 'X' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addItem', () => {
    it('adds item to frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'F', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;

      const result = await frameHandler.addItem(
        { frame: frameId, item_id: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent frame', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.addItem(
        { frame: 'nonexistent', item_id: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.addItem(
        { frame: 'test', item_id: 'item-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeItem', () => {
    it('removes item from frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'F', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;
      await frameHandler.addItem({ frame: frameId, item_id: 'item-1' }, storage)();

      const result = await frameHandler.removeItem(
        { frame: frameId, item_id: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent frame', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.removeItem(
        { frame: 'nonexistent', item_id: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('succeeds even if item not in frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'F', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;

      const result = await frameHandler.removeItem(
        { frame: frameId, item_id: 'not-there' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('delete', () => {
    it('deletes an existing frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'F', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;

      const result = await frameHandler.delete({ frame: frameId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent frame', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.delete(
        { frame: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.delete({ frame: 'test' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('lists frames for a canvas', async () => {
      const storage = createTestStorage();
      await frameHandler.create(
        { canvas: 'c1', name: 'F1', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();

      const result = await frameHandler.list({ canvas: 'c1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const items = JSON.parse((result.right as any).frames);
        expect(items.length).toBeGreaterThan(0);
      }
    });

    it('returns empty list for empty canvas', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.list({ canvas: 'empty' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const items = JSON.parse((result.right as any).frames);
        expect(items).toHaveLength(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.list({ canvas: 'c1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setBackground', () => {
    it('sets background color on frame', async () => {
      const storage = createTestStorage();
      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'F', x: 0, y: 0, width: 100, height: 100 },
        storage,
      )();
      const frameId = (createResult as any).right.frame;

      const result = await frameHandler.setBackground(
        { frame: frameId, color: '#ff0000' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent frame', async () => {
      const storage = createTestStorage();
      const result = await frameHandler.setBackground(
        { frame: 'nonexistent', color: '#ff0000' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await frameHandler.setBackground(
        { frame: 'test', color: '#000' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: create -> addItem -> removeItem -> delete', () => {
    it('completes full frame lifecycle', async () => {
      const storage = createTestStorage();

      const createResult = await frameHandler.create(
        { canvas: 'c1', name: 'Lifecycle', x: 0, y: 0, width: 200, height: 150 },
        storage,
      )();
      expect(E.isRight(createResult)).toBe(true);
      const frameId = (createResult as any).right.frame;

      await frameHandler.addItem({ frame: frameId, item_id: 'i1' }, storage)();
      await frameHandler.addItem({ frame: frameId, item_id: 'i2' }, storage)();
      await frameHandler.removeItem({ frame: frameId, item_id: 'i1' }, storage)();

      const deleteResult = await frameHandler.delete({ frame: frameId }, storage)();
      expect(E.isRight(deleteResult)).toBe(true);
      if (E.isRight(deleteResult)) {
        expect(deleteResult.right.variant).toBe('ok');
      }
    });
  });
});
