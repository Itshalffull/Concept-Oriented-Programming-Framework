// DataQuality — handler.test.ts
// Unit tests for dataQuality handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { dataQualityHandler } from './handler.js';
import type { DataQualityStorage } from './types.js';

const createTestStorage = (): DataQualityStorage => {
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

const createFailingStorage = (): DataQualityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DataQuality handler', () => {
  describe('validate', () => {
    it('returns notfound when ruleset does not exist', async () => {
      const storage = createTestStorage();
      const result = await dataQualityHandler.validate(
        { item: '{"name":"test"}', rulesetId: 'missing-rules' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns invalid when item JSON is malformed', async () => {
      const storage = createTestStorage();
      // Create a ruleset first
      await storage.put('rulesets', 'rules-1', {
        rules: JSON.stringify([{ field: 'name', rule: 'required' }]),
      });
      const result = await dataQualityHandler.validate(
        { item: 'not-json', rulesetId: 'rules-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('returns ok when item passes all rules', async () => {
      const storage = createTestStorage();
      await storage.put('rulesets', 'rules-1', {
        rules: JSON.stringify([{ field: 'name', rule: 'required' }]),
      });
      const result = await dataQualityHandler.validate(
        { item: '{"name":"test"}', rulesetId: 'rules-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataQualityHandler.validate(
        { item: '{"name":"test"}', rulesetId: 'rules-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('quarantine', () => {
    it('returns ok after quarantining an item', async () => {
      const storage = createTestStorage();
      const result = await dataQualityHandler.quarantine(
        { itemId: 'item-1', violations: 'missing required field' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataQualityHandler.quarantine(
        { itemId: 'item-1', violations: 'error' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('release', () => {
    it('returns ok when item is in quarantine', async () => {
      const storage = createTestStorage();
      await dataQualityHandler.quarantine({ itemId: 'item-1', violations: 'error' }, storage)();
      const result = await dataQualityHandler.release({ itemId: 'item-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when item is not in quarantine', async () => {
      const storage = createTestStorage();
      const result = await dataQualityHandler.release({ itemId: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataQualityHandler.release({ itemId: 'item-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('profile', () => {
    it('returns ok with profile data', async () => {
      const storage = createTestStorage();
      const result = await dataQualityHandler.profile(
        { datasetQuery: 'all' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataQualityHandler.profile(
        { datasetQuery: 'all' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reconcile', () => {
    it('returns ok with matches', async () => {
      const storage = createTestStorage();
      const result = await dataQualityHandler.reconcile(
        { field: 'test-value', knowledgeBase: 'kb-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataQualityHandler.reconcile(
        { field: 'test', knowledgeBase: 'kb-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
