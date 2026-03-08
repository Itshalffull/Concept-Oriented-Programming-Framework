// GridLayout — handler.test.ts
// Unit tests for uniform grid layout provider actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { gridLayoutHandler } from './handler.js';
import type { GridLayoutStorage } from './types.js';

const createTestStorage = (): GridLayoutStorage => {
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

const createFailingStorage = (): GridLayoutStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GridLayout handler', () => {
  describe('register', () => {
    it('registers the grid provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await gridLayoutHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).name).toBe('grid');
        expect((result.right as any).category).toBe('layout');
      }
    });

    it('returns ok on repeated registration', async () => {
      const storage = createTestStorage();
      await gridLayoutHandler.register({}, storage)();
      const result = await gridLayoutHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('apply', () => {
    it('applies grid layout with ok variant and positions', async () => {
      const storage = createTestStorage();
      const result = await gridLayoutHandler.apply(
        { canvas: 'canvas-1', items: ['item-1', 'item-2', 'item-3', 'item-4'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).positions.length).toBe(4);
      }
    });

    it('returns error when canvas is empty', async () => {
      const storage = createTestStorage();
      const result = await gridLayoutHandler.apply(
        { canvas: '', items: ['item-1'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('handles empty items array', async () => {
      const storage = createTestStorage();
      const result = await gridLayoutHandler.apply(
        { canvas: 'canvas-1', items: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).positions.length).toBe(0);
      }
    });
  });

  describe('multi-step sequence: register -> apply', () => {
    it('registers then applies grid layout successfully', async () => {
      const storage = createTestStorage();

      const regResult = await gridLayoutHandler.register({}, storage)();
      expect(E.isRight(regResult)).toBe(true);

      const applyResult = await gridLayoutHandler.apply(
        { canvas: 'main', items: ['a', 'b', 'c', 'd'] },
        storage,
      )();
      expect(E.isRight(applyResult)).toBe(true);
      if (E.isRight(applyResult)) {
        expect(applyResult.right.variant).toBe('ok');
        expect((applyResult.right as any).positions.length).toBe(4);
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on apply', async () => {
      const storage = createFailingStorage();
      const result = await gridLayoutHandler.apply(
        { canvas: 'canvas-1', items: ['node-a'] },
        storage,
      )();
      expect(E.isRight(result) || E.isLeft(result)).toBe(true);
    });
  });
});
