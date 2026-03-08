// Shape — handler.test.ts
// Unit tests for Shape geometric primitive handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { shapeHandler } from './handler.js';
import type { ShapeStorage } from './types.js';

const createTestStorage = (): ShapeStorage => {
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

const createFailingStorage = (): ShapeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Shape handler', () => {
  describe('create', () => {
    it('creates a new shape with ok variant', async () => {
      const storage = createTestStorage();
      const result = await shapeHandler.create(
        { kind: 'rectangle', fill: '#ff0000', stroke: '#000000' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).shape).toBeDefined();
      }
    });

    it('creates shape with optional fields omitted', async () => {
      const storage = createTestStorage();
      const result = await shapeHandler.create(
        { kind: 'circle' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await shapeHandler.create(
        { kind: 'rectangle' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('updates an existing shape with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await shapeHandler.create(
        { kind: 'rectangle', fill: '#ff0000' },
        storage,
      )();
      const shapeId = (createResult as any).right.shape;

      const result = await shapeHandler.update(
        { shape: shapeId, fill: '#00ff00' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent shape', async () => {
      const storage = createTestStorage();
      const result = await shapeHandler.update(
        { shape: 'nonexistent', fill: '#00ff00' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await shapeHandler.update(
        { shape: 'any', fill: '#00ff00' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('deletes an existing shape with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await shapeHandler.create(
        { kind: 'rectangle' },
        storage,
      )();
      const shapeId = (createResult as any).right.shape;

      const result = await shapeHandler.delete(
        { shape: shapeId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent shape', async () => {
      const storage = createTestStorage();
      const result = await shapeHandler.delete(
        { shape: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await shapeHandler.delete(
        { shape: 'any' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('lists all shapes with ok variant', async () => {
      const storage = createTestStorage();
      await shapeHandler.create({ kind: 'rectangle' }, storage)();
      await shapeHandler.create({ kind: 'circle' }, storage)();

      const result = await shapeHandler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const shapes = JSON.parse((result.right as any).shapes);
        expect(shapes.length).toBe(2);
      }
    });

    it('returns empty list when no shapes exist', async () => {
      const storage = createTestStorage();
      const result = await shapeHandler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const shapes = JSON.parse((result.right as any).shapes);
        expect(shapes.length).toBe(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await shapeHandler.list({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: create -> update -> list -> delete', () => {
    it('completes full lifecycle', async () => {
      const storage = createTestStorage();

      const createResult = await shapeHandler.create(
        { kind: 'rectangle', fill: '#ff0000' },
        storage,
      )();
      expect(E.isRight(createResult)).toBe(true);
      const shapeId = (createResult as any).right.shape;

      const updateResult = await shapeHandler.update(
        { shape: shapeId, fill: '#00ff00' },
        storage,
      )();
      expect(E.isRight(updateResult)).toBe(true);
      if (E.isRight(updateResult)) {
        expect(updateResult.right.variant).toBe('ok');
      }

      const listResult = await shapeHandler.list({}, storage)();
      expect(E.isRight(listResult)).toBe(true);
      if (E.isRight(listResult)) {
        const shapes = JSON.parse((listResult.right as any).shapes);
        expect(shapes.length).toBe(1);
      }

      const deleteResult = await shapeHandler.delete(
        { shape: shapeId },
        storage,
      )();
      expect(E.isRight(deleteResult)).toBe(true);
      if (E.isRight(deleteResult)) {
        expect(deleteResult.right.variant).toBe('ok');
      }
    });
  });
});
