// Formula — handler.test.ts
// Unit tests for formula handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { formulaHandler } from './handler.js';
import type { FormulaStorage } from './types.js';

const createTestStorage = (): FormulaStorage => {
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

const createFailingStorage = (): FormulaStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Formula handler', () => {
  describe('create', () => {
    it('should create a new formula', async () => {
      const storage = createTestStorage();
      const result = await formulaHandler.create(
        { formula: 'total', expression: 'price * quantity' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate formula', async () => {
      const storage = createTestStorage();
      await formulaHandler.create({ formula: 'total', expression: '1 + 2' }, storage)();
      const result = await formulaHandler.create(
        { formula: 'total', expression: '3 + 4' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await formulaHandler.create(
        { formula: 'f', expression: '1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('should evaluate a simple arithmetic expression', async () => {
      const storage = createTestStorage();
      await formulaHandler.create({ formula: 'sum', expression: '10 + 5' }, storage)();
      const result = await formulaHandler.evaluate({ formula: 'sum' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('15');
        }
      }
    });

    it('should return notfound for unknown formula', async () => {
      const storage = createTestStorage();
      const result = await formulaHandler.evaluate({ formula: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return cached result when not stale', async () => {
      const storage = createTestStorage();
      await formulaHandler.create({ formula: 'cached', expression: '2 * 3' }, storage)();
      // First evaluation caches
      await formulaHandler.evaluate({ formula: 'cached' }, storage)();
      // Second evaluation should use cache
      const result = await formulaHandler.evaluate({ formula: 'cached' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.result).toBe('6');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await formulaHandler.evaluate({ formula: 'f' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getDependencies', () => {
    it('should return dependencies of a formula', async () => {
      const storage = createTestStorage();
      await formulaHandler.create({ formula: 'total', expression: 'price * quantity' }, storage)();
      const result = await formulaHandler.getDependencies({ formula: 'total' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const deps = JSON.parse(result.right.deps);
          expect(deps).toContain('price');
          expect(deps).toContain('quantity');
        }
      }
    });

    it('should return notfound for unknown formula', async () => {
      const storage = createTestStorage();
      const result = await formulaHandler.getDependencies({ formula: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await formulaHandler.getDependencies({ formula: 'f' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should invalidate a formula and mark it stale', async () => {
      const storage = createTestStorage();
      await formulaHandler.create({ formula: 'total', expression: '10 + 5' }, storage)();
      await formulaHandler.evaluate({ formula: 'total' }, storage)();
      const result = await formulaHandler.invalidate({ formula: 'total' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for unknown formula', async () => {
      const storage = createTestStorage();
      const result = await formulaHandler.invalidate({ formula: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await formulaHandler.invalidate({ formula: 'f' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setExpression', () => {
    it('should update a formula expression', async () => {
      const storage = createTestStorage();
      await formulaHandler.create({ formula: 'total', expression: '1 + 2' }, storage)();
      const result = await formulaHandler.setExpression(
        { formula: 'total', expression: '3 + 4' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for unknown formula', async () => {
      const storage = createTestStorage();
      const result = await formulaHandler.setExpression(
        { formula: 'nope', expression: '1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await formulaHandler.setExpression(
        { formula: 'f', expression: '1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
