// KitManager — handler.test.ts
// Unit tests for kitManager handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { kitManagerHandler } from './handler.js';
import type { KitManagerStorage } from './types.js';

const createTestStorage = (): KitManagerStorage => {
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

const createFailingStorage = (): KitManagerStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('KitManager handler', () => {
  describe('init', () => {
    it('should initialize a new suite', async () => {
      const storage = createTestStorage();
      const input = { name: 'my-suite' };

      const result = await kitManagerHandler.init(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.kit).toBe('my-suite');
          expect(result.right.path).toBe('suites/my-suite');
        }
      }
    });

    it('should return alreadyExists for duplicate suite name', async () => {
      const storage = createTestStorage();
      await kitManagerHandler.init({ name: 'dup-suite' }, storage)();

      const result = await kitManagerHandler.init({ name: 'dup-suite' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kitManagerHandler.init({ name: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate an existing suite', async () => {
      const storage = createTestStorage();
      await kitManagerHandler.init({ name: 'valid-suite' }, storage)();

      const result = await kitManagerHandler.validate({
        path: 'suites/valid-suite',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.kit).toBe('valid-suite');
        }
      }
    });

    it('should return error for missing suite path', async () => {
      const storage = createTestStorage();
      const result = await kitManagerHandler.validate({
        path: 'suites/nonexistent',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kitManagerHandler.validate({ path: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('test', () => {
    it('should run tests for an existing suite', async () => {
      const storage = createTestStorage();
      await kitManagerHandler.init({ name: 'test-suite' }, storage)();

      const result = await kitManagerHandler.test({
        path: 'suites/test-suite',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.kit).toBe('test-suite');
          expect(typeof result.right.passed).toBe('number');
          expect(typeof result.right.failed).toBe('number');
        }
      }
    });

    it('should return error for missing suite', async () => {
      const storage = createTestStorage();
      const result = await kitManagerHandler.test({
        path: 'suites/missing',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kitManagerHandler.test({ path: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('should list all registered suites', async () => {
      const storage = createTestStorage();
      await kitManagerHandler.init({ name: 'suite-a' }, storage)();
      await kitManagerHandler.init({ name: 'suite-b' }, storage)();

      const result = await kitManagerHandler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.suites).toContain('suite-a');
        expect(result.right.suites).toContain('suite-b');
      }
    });

    it('should return empty list when no suites exist', async () => {
      const storage = createTestStorage();
      const result = await kitManagerHandler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.suites).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kitManagerHandler.list({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkOverrides', () => {
    it('should return ok with zero valid when no overrides exist', async () => {
      const storage = createTestStorage();
      const result = await kitManagerHandler.checkOverrides({
        path: 'suites/my',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.valid).toBe(0);
          expect(result.right.warnings).toHaveLength(0);
        }
      }
    });

    it('should return invalidOverride when concept not found', async () => {
      const storage = createTestStorage();
      // Add an override that references a non-existent concept
      await storage.put('override', 'o1', {
        path: 'suites/test',
        concept: 'missing-concept',
        action: 'create',
      });

      const result = await kitManagerHandler.checkOverrides({
        path: 'suites/test',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidOverride');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kitManagerHandler.checkOverrides({ path: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
