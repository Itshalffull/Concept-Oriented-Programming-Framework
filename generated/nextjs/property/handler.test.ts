// Property — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { propertyHandler } from './handler.js';
import type { PropertyStorage } from './types.js';

const createTestStorage = (): PropertyStorage => {
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

const createFailingStorage = (): PropertyStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = propertyHandler;

describe('Property handler', () => {
  describe('set', () => {
    it('should set a property on an entity and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.set(
        { entity: 'article-1', key: 'title', value: 'Hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('article-1');
        }
      }
    });

    it('should return invalid for non-numeric value on _number key', async () => {
      const storage = createTestStorage();
      const result = await handler.set(
        { entity: 'e1', key: 'age_number', value: 'abc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should accept numeric value on _number key', async () => {
      const storage = createTestStorage();
      const result = await handler.set(
        { entity: 'e1', key: 'age_number', value: '42' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for non-boolean value on _bool key', async () => {
      const storage = createTestStorage();
      const result = await handler.set(
        { entity: 'e1', key: 'active_bool', value: 'yes' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should accept boolean value on _flag key', async () => {
      const storage = createTestStorage();
      const result = await handler.set(
        { entity: 'e1', key: 'active_flag', value: 'true' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for bad date on _date key', async () => {
      const storage = createTestStorage();
      const result = await handler.set(
        { entity: 'e1', key: 'created_date', value: 'not-a-date' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure for valid property', async () => {
      const storage = createFailingStorage();
      const result = await handler.set(
        { entity: 'e1', key: 'title', value: 'Hello' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return notfound for non-existent property', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { entity: 'e1', key: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return the stored value after set', async () => {
      const storage = createTestStorage();
      await handler.set({ entity: 'e1', key: 'color', value: 'blue' }, storage)();

      const result = await handler.get({ entity: 'e1', key: 'color' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('blue');
        }
      }
    });
  });

  describe('delete', () => {
    it('should return notfound for non-existent property', async () => {
      const storage = createTestStorage();
      const result = await handler.delete(
        { entity: 'e1', key: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should delete a set property and return ok', async () => {
      const storage = createTestStorage();
      await handler.set({ entity: 'e1', key: 'temp', value: 'val' }, storage)();

      const result = await handler.delete({ entity: 'e1', key: 'temp' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Confirm it is gone
      const getResult = await handler.get({ entity: 'e1', key: 'temp' }, storage)();
      expect(E.isRight(getResult)).toBe(true);
      if (E.isRight(getResult)) {
        expect(getResult.right.variant).toBe('notfound');
      }
    });
  });

  describe('listAll', () => {
    it('should return empty properties for unknown entity', async () => {
      const storage = createTestStorage();
      const result = await handler.listAll({ entity: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(JSON.parse(result.right.properties)).toEqual({});
      }
    });

    it('should return all set properties', async () => {
      const storage = createTestStorage();
      await handler.set({ entity: 'e1', key: 'a', value: '1' }, storage)();
      await handler.set({ entity: 'e1', key: 'b', value: '2' }, storage)();

      const result = await handler.listAll({ entity: 'e1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const props = JSON.parse(result.right.properties);
        expect(props.a).toBe('1');
        expect(props.b).toBe('2');
      }
    });
  });
});
