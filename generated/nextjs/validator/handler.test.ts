// Validator — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { validatorHandler } from './handler.js';
import type { ValidatorStorage } from './types.js';

const createTestStorage = (): ValidatorStorage => {
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

const createFailingStorage = (): ValidatorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = validatorHandler;

describe('Validator handler', () => {
  describe('registerConstraint', () => {
    it('should register a new constraint', async () => {
      const storage = createTestStorage();
      const result = await handler.registerConstraint(
        { validator: 'v1', constraint: 'string-length' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when constraint already registered', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint(
        { validator: 'v1', constraint: 'email' },
        storage,
      )();
      const result = await handler.registerConstraint(
        { validator: 'v1', constraint: 'email' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerConstraint(
        { validator: 'v1', constraint: 'fail' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addRule', () => {
    it('should add a rule when validator has constraints', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint(
        { validator: 'v2', constraint: 'base' },
        storage,
      )();
      const result = await handler.addRule(
        { validator: 'v2', field: 'email', rule: 'required|email' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when validator has no constraints', async () => {
      const storage = createTestStorage();
      const result = await handler.addRule(
        { validator: 'unknown', field: 'name', rule: 'required' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should merge rules on the same field', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint(
        { validator: 'v3', constraint: 'base' },
        storage,
      )();
      await handler.addRule(
        { validator: 'v3', field: 'name', rule: 'required' },
        storage,
      )();
      await handler.addRule(
        { validator: 'v3', field: 'name', rule: 'min:3' },
        storage,
      )();
      const stored = await storage.get('rules', 'v3::rule::name');
      expect(stored).not.toBeNull();
      expect((stored!.rules as string)).toContain('required');
      expect((stored!.rules as string)).toContain('min:3');
    });
  });

  describe('validate', () => {
    it('should return valid when all rules pass', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint({ validator: 'v4', constraint: 'base' }, storage)();
      await handler.addRule({ validator: 'v4', field: 'name', rule: 'required|string' }, storage)();
      await handler.addRule({ validator: 'v4', field: 'email', rule: 'required|email' }, storage)();

      const result = await handler.validate(
        { validator: 'v4', data: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.valid).toBe(true);
        expect(result.right.errors).toBe('');
      }
    });

    it('should return invalid with error messages when rules fail', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint({ validator: 'v5', constraint: 'base' }, storage)();
      await handler.addRule({ validator: 'v5', field: 'name', rule: 'required' }, storage)();

      const result = await handler.validate(
        { validator: 'v5', data: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.valid).toBe(false);
        expect(result.right.errors).toContain('name is required');
      }
    });

    it('should validate email format', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint({ validator: 'v6', constraint: 'base' }, storage)();
      await handler.addRule({ validator: 'v6', field: 'email', rule: 'email' }, storage)();

      const result = await handler.validate(
        { validator: 'v6', data: JSON.stringify({ email: 'not-an-email' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.valid).toBe(false);
        expect(result.right.errors).toContain('valid email');
      }
    });

    it('should validate min/max length', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint({ validator: 'v7', constraint: 'base' }, storage)();
      await handler.addRule({ validator: 'v7', field: 'name', rule: 'min:3|max:10' }, storage)();

      const shortResult = await handler.validate(
        { validator: 'v7', data: JSON.stringify({ name: 'ab' }) },
        storage,
      )();
      expect(E.isRight(shortResult)).toBe(true);
      if (E.isRight(shortResult)) {
        expect(shortResult.right.valid).toBe(false);
        expect(shortResult.right.errors).toContain('at least 3');
      }

      const longResult = await handler.validate(
        { validator: 'v7', data: JSON.stringify({ name: 'this is way too long' }) },
        storage,
      )();
      expect(E.isRight(longResult)).toBe(true);
      if (E.isRight(longResult)) {
        expect(longResult.right.valid).toBe(false);
        expect(longResult.right.errors).toContain('at most 10');
      }
    });

    it('should handle malformed JSON data gracefully', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint({ validator: 'v8', constraint: 'base' }, storage)();
      await handler.addRule({ validator: 'v8', field: 'name', rule: 'required' }, storage)();

      const result = await handler.validate(
        { validator: 'v8', data: '{{invalid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.valid).toBe(false);
      }
    });
  });

  describe('validateField', () => {
    it('should validate a single field', async () => {
      const storage = createTestStorage();
      await handler.registerConstraint({ validator: 'vf1', constraint: 'base' }, storage)();
      await handler.addRule({ validator: 'vf1', field: 'email', rule: 'required|email' }, storage)();

      const result = await handler.validateField(
        { validator: 'vf1', field: 'email', value: 'valid@example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.valid).toBe(true);
      }
    });

    it('should return valid for a field with no rules', async () => {
      const storage = createTestStorage();
      const result = await handler.validateField(
        { validator: 'vf2', field: 'unknown-field', value: 'anything' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.valid).toBe(true);
      }
    });
  });

  describe('addCustomValidator', () => {
    it('should register a custom validator', async () => {
      const storage = createTestStorage();
      const result = await handler.addCustomValidator(
        { validator: 'vc1', name: 'phone', implementation: '(v) => /^\\+?\\d+$/.test(v)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when custom validator already registered', async () => {
      const storage = createTestStorage();
      await handler.addCustomValidator(
        { validator: 'vc2', name: 'zip', implementation: '(v) => /^\\d{5}$/.test(v)' },
        storage,
      )();
      const result = await handler.addCustomValidator(
        { validator: 'vc2', name: 'zip', implementation: '(v) => true' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.addCustomValidator(
        { validator: 'vc3', name: 'fail', implementation: '() => true' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
