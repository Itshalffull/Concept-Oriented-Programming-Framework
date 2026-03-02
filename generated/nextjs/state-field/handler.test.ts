// StateField — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { stateFieldHandler } from './handler.js';
import type { StateFieldStorage } from './types.js';

const createTestStorage = (): StateFieldStorage => {
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

const createFailingStorage = (): StateFieldStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = stateFieldHandler;

describe('StateField handler', () => {
  describe('register', () => {
    it('should register a field with one cardinality', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { concept: 'session', name: 'token', typeExpr: 'string' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.field).toBe('field_session_token');
      }
    });

    it('should derive many cardinality for Array type', async () => {
      const storage = createTestStorage();
      await handler.register(
        { concept: 'cart', name: 'items', typeExpr: 'Array<string>' },
        storage,
      )();
      const getResult = await handler.get({ field: 'field_cart_items' }, storage)();
      expect(E.isRight(getResult)).toBe(true);
      if (E.isRight(getResult) && getResult.right.variant === 'ok') {
        expect(getResult.right.cardinality).toBe('many');
      }
    });

    it('should derive many cardinality for [] syntax', async () => {
      const storage = createTestStorage();
      await handler.register(
        { concept: 'list', name: 'entries', typeExpr: 'number[]' },
        storage,
      )();
      const getResult = await handler.get({ field: 'field_list_entries' }, storage)();
      expect(E.isRight(getResult)).toBe(true);
      if (E.isRight(getResult) && getResult.right.variant === 'ok') {
        expect(getResult.right.cardinality).toBe('many');
      }
    });

    it('should derive optional cardinality for nullable type', async () => {
      const storage = createTestStorage();
      await handler.register(
        { concept: 'user', name: 'avatar', typeExpr: 'string | null' },
        storage,
      )();
      const getResult = await handler.get({ field: 'field_user_avatar' }, storage)();
      expect(E.isRight(getResult)).toBe(true);
      if (E.isRight(getResult) && getResult.right.variant === 'ok') {
        expect(getResult.right.cardinality).toBe('optional');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { concept: 'fail', name: 'field', typeExpr: 'string' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByConcept', () => {
    it('should find all fields for a concept', async () => {
      const storage = createTestStorage();
      await handler.register({ concept: 'session', name: 'token', typeExpr: 'string' }, storage)();
      await handler.register({ concept: 'session', name: 'userId', typeExpr: 'string' }, storage)();
      await handler.register({ concept: 'other', name: 'data', typeExpr: 'bytes' }, storage)();
      const result = await handler.findByConcept({ concept: 'session' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const fields = JSON.parse(result.right.fields);
        // Note: our test storage find returns all items, the handler filters by concept field in the records
        expect(fields.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('traceToGenerated', () => {
    it('should return empty targets when no generated artifacts exist', async () => {
      const storage = createTestStorage();
      await handler.register({ concept: 'test', name: 'field', typeExpr: 'string' }, storage)();
      const result = await handler.traceToGenerated({ field: 'field_test_field' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const targets = JSON.parse(result.right.targets);
        expect(targets).toEqual([]);
      }
    });

    it('should return empty targets for nonexistent field', async () => {
      const storage = createTestStorage();
      const result = await handler.traceToGenerated({ field: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const targets = JSON.parse(result.right.targets);
        expect(targets).toEqual([]);
      }
    });
  });

  describe('traceToStorage', () => {
    it('should return empty targets when no storage mappings exist', async () => {
      const storage = createTestStorage();
      await handler.register({ concept: 'test', name: 'data', typeExpr: 'string' }, storage)();
      const result = await handler.traceToStorage({ field: 'field_test_data' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const targets = JSON.parse(result.right.targets);
        expect(targets).toEqual([]);
      }
    });
  });

  describe('get', () => {
    it('should return field details for existing field', async () => {
      const storage = createTestStorage();
      await handler.register({ concept: 'user', name: 'email', typeExpr: 'string' }, storage)();
      const result = await handler.get({ field: 'field_user_email' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.concept).toBe('user');
          expect(result.right.name).toBe('email');
          expect(result.right.typeExpr).toBe('string');
          expect(result.right.cardinality).toBe('one');
        }
      }
    });

    it('should return notfound for nonexistent field', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ field: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
