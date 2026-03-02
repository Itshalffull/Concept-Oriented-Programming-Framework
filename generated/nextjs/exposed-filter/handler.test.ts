// ExposedFilter — handler.test.ts
// Unit tests for exposedFilter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { exposedFilterHandler } from './handler.js';
import type { ExposedFilterStorage } from './types.js';

const createTestStorage = (): ExposedFilterStorage => {
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

const createFailingStorage = (): ExposedFilterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ExposedFilter handler', () => {
  describe('expose', () => {
    it('should expose a new filter with ok variant', async () => {
      const storage = createTestStorage();
      const result = await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filter).toBe('status-filter');
        }
      }
    });

    it('should return exists when filter already registered', async () => {
      const storage = createTestStorage();
      await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      const result = await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return exists for invalid operator', async () => {
      const storage = createTestStorage();
      const result = await exposedFilterHandler.expose(
        { filter: 'bad-filter', fieldName: 'status', operator: 'invalid_op', defaultValue: 'active' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('collectInput', () => {
    it('should collect user input for an existing filter', async () => {
      const storage = createTestStorage();
      await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      const result = await exposedFilterHandler.collectInput(
        { filter: 'status-filter', value: 'inactive' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent filter', async () => {
      const storage = createTestStorage();
      const result = await exposedFilterHandler.collectInput(
        { filter: 'missing', value: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await exposedFilterHandler.collectInput(
        { filter: 'status-filter', value: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('applyToQuery', () => {
    it('should generate a query modification clause', async () => {
      const storage = createTestStorage();
      await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      const result = await exposedFilterHandler.applyToQuery(
        { filter: 'status-filter' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const queryMod = JSON.parse(result.right.queryMod);
          expect(queryMod.field).toBe('status');
          expect(queryMod.operator).toBe('=');
          expect(queryMod.value).toBe('active');
        }
      }
    });

    it('should use collected value when set', async () => {
      const storage = createTestStorage();
      await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'contains', defaultValue: 'active' },
        storage,
      )();
      await exposedFilterHandler.collectInput(
        { filter: 'status-filter', value: 'archived' },
        storage,
      )();
      const result = await exposedFilterHandler.applyToQuery(
        { filter: 'status-filter' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const queryMod = JSON.parse(result.right.queryMod);
          expect(queryMod.value).toBe('archived');
          expect(queryMod.operator).toBe('CONTAINS');
        }
      }
    });

    it('should return notfound for nonexistent filter', async () => {
      const storage = createTestStorage();
      const result = await exposedFilterHandler.applyToQuery(
        { filter: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await exposedFilterHandler.applyToQuery(
        { filter: 'status-filter' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset filter to its default value', async () => {
      const storage = createTestStorage();
      await exposedFilterHandler.expose(
        { filter: 'status-filter', fieldName: 'status', operator: 'eq', defaultValue: 'active' },
        storage,
      )();
      await exposedFilterHandler.collectInput(
        { filter: 'status-filter', value: 'archived' },
        storage,
      )();
      const result = await exposedFilterHandler.resetToDefaults(
        { filter: 'status-filter' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent filter', async () => {
      const storage = createTestStorage();
      const result = await exposedFilterHandler.resetToDefaults(
        { filter: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await exposedFilterHandler.resetToDefaults(
        { filter: 'status-filter' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
