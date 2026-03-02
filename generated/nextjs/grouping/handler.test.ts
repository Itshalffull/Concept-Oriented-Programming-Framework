// Grouping — handler.test.ts
// Unit tests for grouping handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { groupingHandler } from './handler.js';
import type { GroupingStorage } from './types.js';

const createTestStorage = (): GroupingStorage => {
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

const createFailingStorage = (): GroupingStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Grouping handler', () => {
  describe('group', () => {
    it('should group items by field strategy', async () => {
      const storage = createTestStorage();
      const items = [
        JSON.stringify({ category: 'fruit', name: 'apple' }),
        JSON.stringify({ category: 'fruit', name: 'banana' }),
        JSON.stringify({ category: 'vegetable', name: 'carrot' }),
      ];
      const result = await groupingHandler.group(
        { items, config: JSON.stringify({ strategy: 'field', field: 'category' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.groupCount).toBe(2);
          expect(result.right.groups.length).toBe(2);
        }
      }
    });

    it('should group items by prefix strategy', async () => {
      const storage = createTestStorage();
      const items = [
        JSON.stringify({ value: 'apple' }),
        JSON.stringify({ value: 'avocado' }),
        JSON.stringify({ value: 'banana' }),
      ];
      const result = await groupingHandler.group(
        { items, config: JSON.stringify({ strategy: 'prefix', field: 'value', prefixLength: 1 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.groupCount).toBe(2); // 'a' and 'b'
      }
    });

    it('should group items by range strategy', async () => {
      const storage = createTestStorage();
      const items = [
        JSON.stringify({ price: 5 }),
        JSON.stringify({ price: 15 }),
        JSON.stringify({ price: 25 }),
        JSON.stringify({ price: 8 }),
      ];
      const result = await groupingHandler.group(
        { items, config: JSON.stringify({ strategy: 'range', field: 'price', step: 10 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.groupCount).toBe(3); // 0-10, 10-20, 20-30
      }
    });

    it('should return emptyInput for empty items', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.group(
        { items: [], config: JSON.stringify({ strategy: 'field' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('emptyInput');
      }
    });

    it('should return invalidStrategy for unknown strategy', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.group(
        { items: ['a'], config: JSON.stringify({ strategy: 'unknown' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidStrategy');
      }
    });

    it('should return invalidStrategy for unparseable config', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.group(
        { items: ['a'], config: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidStrategy');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await groupingHandler.group(
        { items: ['a'], config: JSON.stringify({ strategy: 'field' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('classify', () => {
    it('should classify a create action', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'createUser' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.crudRole).toBe('create');
        expect(result.right.intent).toBe('mutation');
        expect(result.right.eventProducing).toBe(true);
        expect(result.right.eventVerb).toBe('created');
        expect(result.right.mcpType).toBe('tool');
      }
    });

    it('should classify a read action', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'getUser' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.crudRole).toBe('read');
        expect(result.right.intent).toBe('query');
        expect(result.right.eventProducing).toBe(false);
        expect(result.right.mcpType).toBe('resource');
      }
    });

    it('should classify an update action', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'updateProfile' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.crudRole).toBe('update');
        expect(result.right.intent).toBe('mutation');
        expect(result.right.eventProducing).toBe(true);
        expect(result.right.eventVerb).toBe('updated');
      }
    });

    it('should classify a delete action', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'deleteItem' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.crudRole).toBe('delete');
        expect(result.right.intent).toBe('mutation');
        expect(result.right.eventProducing).toBe(true);
        expect(result.right.eventVerb).toBe('deleted');
      }
    });

    it('should classify a list action as read', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'listOrders' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.crudRole).toBe('read');
        expect(result.right.mcpType).toBe('resource');
      }
    });

    it('should classify an add action as create', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'addMember' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.crudRole).toBe('create');
        expect(result.right.eventVerb).toBe('added');
      }
    });

    it('should classify unknown action as unknown', async () => {
      const storage = createTestStorage();
      const result = await groupingHandler.classify(
        { actionName: 'doSomething' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.crudRole).toBe('unknown');
        expect(result.right.intent).toBe('side-effect');
      }
    });

    it('should return Right even with failing storage since classify is a pure transform', async () => {
      const storage = createFailingStorage();
      // classify does not access storage, so it always returns Right
      const result = await groupingHandler.classify(
        { actionName: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
