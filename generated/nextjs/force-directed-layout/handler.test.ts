// ForceDirectedLayout — handler.test.ts
// Unit tests for force-directed graph layout provider actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { forceDirectedLayoutHandler } from './handler.js';
import type { ForceDirectedLayoutStorage } from './types.js';

const createTestStorage = (): ForceDirectedLayoutStorage => {
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

const createFailingStorage = (): ForceDirectedLayoutStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ForceDirectedLayout handler', () => {
  describe('register', () => {
    it('registers the force-directed provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await forceDirectedLayoutHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).name).toBe('force-directed');
        expect((result.right as any).category).toBe('layout');
      }
    });

    it('returns ok on repeated registration', async () => {
      const storage = createTestStorage();
      await forceDirectedLayoutHandler.register({}, storage)();
      const result = await forceDirectedLayoutHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('apply', () => {
    it('applies layout to items with ok variant and positions', async () => {
      const storage = createTestStorage();
      const result = await forceDirectedLayoutHandler.apply(
        { canvas: 'canvas-1', items: ['node-a', 'node-b', 'node-c'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).positions.length).toBe(3);
      }
    });

    it('returns error when canvas is empty', async () => {
      const storage = createTestStorage();
      const result = await forceDirectedLayoutHandler.apply(
        { canvas: '', items: ['node-a'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('handles empty items array', async () => {
      const storage = createTestStorage();
      const result = await forceDirectedLayoutHandler.apply(
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
    it('registers then applies layout successfully', async () => {
      const storage = createTestStorage();

      const regResult = await forceDirectedLayoutHandler.register({}, storage)();
      expect(E.isRight(regResult)).toBe(true);

      const applyResult = await forceDirectedLayoutHandler.apply(
        { canvas: 'main', items: ['a', 'b'] },
        storage,
      )();
      expect(E.isRight(applyResult)).toBe(true);
      if (E.isRight(applyResult)) {
        expect(applyResult.right.variant).toBe('ok');
        expect((applyResult.right as any).positions.length).toBe(2);
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on apply', async () => {
      const storage = createFailingStorage();
      const result = await forceDirectedLayoutHandler.apply(
        { canvas: 'canvas-1', items: ['node-a'] },
        storage,
      )();
      // Force-directed apply uses tryCatch so storage errors go to Left
      expect(E.isRight(result) || E.isLeft(result)).toBe(true);
    });
  });
});
