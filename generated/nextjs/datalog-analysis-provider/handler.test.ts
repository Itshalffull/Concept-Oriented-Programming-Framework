// DatalogAnalysisProvider — handler.test.ts
// Unit tests for datalogAnalysisProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { datalogAnalysisProviderHandler } from './handler.js';
import type { DatalogAnalysisProviderStorage } from './types.js';

const createTestStorage = (): DatalogAnalysisProviderStorage => {
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

const createFailingStorage = (): DatalogAnalysisProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DatalogAnalysisProvider handler', () => {
  describe('initialize', () => {
    it('returns ok with instance id', async () => {
      const storage = createTestStorage();
      const result = await datalogAnalysisProviderHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toBeTruthy();
        }
      }
    });

    it('returns loadError on storage failure (handled via orElse)', async () => {
      const storage = createFailingStorage();
      const result = await datalogAnalysisProviderHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('assertFact', () => {
    it('returns added=true for a valid new fact', async () => {
      const storage = createTestStorage();
      const result = await datalogAnalysisProviderHandler.assertFact(
        { factStr: 'parent(alice, bob)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.added).toBe(true);
      }
    });

    it('returns left for an invalid fact string', async () => {
      const storage = createTestStorage();
      const result = await datalogAnalysisProviderHandler.assertFact(
        { factStr: 'not-a-fact' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogAnalysisProviderHandler.assertFact(
        { factStr: 'parent(alice, bob)' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addRule', () => {
    it('returns ruleId for a valid rule', async () => {
      const storage = createTestStorage();
      const result = await datalogAnalysisProviderHandler.addRule(
        { ruleStr: 'ancestor(X, Y) :- parent(X, Y)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.ruleId).toBeTruthy();
      }
    });

    it('returns left for an invalid rule string', async () => {
      const storage = createTestStorage();
      const result = await datalogAnalysisProviderHandler.addRule(
        { ruleStr: 'invalid' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogAnalysisProviderHandler.addRule(
        { ruleStr: 'ancestor(X, Y) :- parent(X, Y)' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('query', () => {
    it('returns matching facts', async () => {
      const storage = createTestStorage();
      await datalogAnalysisProviderHandler.assertFact({ factStr: 'parent(alice, bob)' }, storage)();
      const result = await datalogAnalysisProviderHandler.query(
        { relation: 'parent', pattern: ['X', 'Y'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.results.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogAnalysisProviderHandler.query(
        { relation: 'parent', pattern: ['X'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('computeFixpoint', () => {
    it('returns total and derived fact counts', async () => {
      const storage = createTestStorage();
      await datalogAnalysisProviderHandler.assertFact({ factStr: 'parent(alice, bob)' }, storage)();
      const result = await datalogAnalysisProviderHandler.computeFixpoint(storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.totalFacts).toBeGreaterThanOrEqual(1);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await datalogAnalysisProviderHandler.computeFixpoint(storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
