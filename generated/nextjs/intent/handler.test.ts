// Intent — handler.test.ts
// Unit tests for intent handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { intentHandler } from './handler.js';
import type { IntentStorage } from './types.js';

const createTestStorage = (): IntentStorage => {
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

const createFailingStorage = (): IntentStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Intent handler', () => {
  describe('define', () => {
    it('should define a new intent', async () => {
      const storage = createTestStorage();
      const input = {
        intent: 'manage-users',
        target: 'user',
        purpose: 'Manage user accounts',
        operationalPrinciple: 'CRUD on user entities',
      };

      const result = await intentHandler.define(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.intent).toBe('manage-users');
        }
      }
    });

    it('should return exists for duplicate intent', async () => {
      const storage = createTestStorage();
      const input = {
        intent: 'dup-intent',
        target: 'order',
        purpose: 'Process orders',
        operationalPrinciple: 'Order lifecycle',
      };

      await intentHandler.define(input, storage)();
      const result = await intentHandler.define(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = {
        intent: 'x', target: 'y', purpose: 'z', operationalPrinciple: 'w',
      };
      const result = await intentHandler.define(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update an existing intent', async () => {
      const storage = createTestStorage();
      await intentHandler.define({
        intent: 'upd', target: 't', purpose: 'old', operationalPrinciple: 'old-op',
      }, storage)();

      const result = await intentHandler.update({
        intent: 'upd', purpose: 'new purpose', operationalPrinciple: 'new op',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing intent', async () => {
      const storage = createTestStorage();
      const result = await intentHandler.update({
        intent: 'missing', purpose: 'x', operationalPrinciple: 'y',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await intentHandler.update({
        intent: 'x', purpose: 'y', operationalPrinciple: 'z',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('verify', () => {
    it('should verify a complete intent as valid', async () => {
      const storage = createTestStorage();
      await intentHandler.define({
        intent: 'valid',
        target: 'user',
        purpose: 'Manage users',
        operationalPrinciple: 'CRUD ops',
      }, storage)();

      const result = await intentHandler.verify({ intent: 'valid' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.valid).toBe(true);
        }
      }
    });

    it('should return notfound for missing intent', async () => {
      const storage = createTestStorage();
      const result = await intentHandler.verify({ intent: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await intentHandler.verify({ intent: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('discover', () => {
    it('should discover intents by keyword', async () => {
      const storage = createTestStorage();
      await intentHandler.define({
        intent: 'auth', target: 'session', purpose: 'Authenticate users',
        operationalPrinciple: 'Token-based auth',
      }, storage)();

      const result = await intentHandler.discover({ query: 'auth' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const matches = JSON.parse(result.right.matches);
        expect(matches.length).toBeGreaterThan(0);
      }
    });

    it('should return empty matches for unknown query', async () => {
      const storage = createTestStorage();
      const result = await intentHandler.discover({ query: 'zzzzzzz' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const matches = JSON.parse(result.right.matches);
        expect(matches).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await intentHandler.discover({ query: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('suggestFromDescription', () => {
    it('should suggest intents based on description words', async () => {
      const storage = createTestStorage();
      await intentHandler.define({
        intent: 'payment', target: 'billing',
        purpose: 'Process payment transactions',
        operationalPrinciple: 'Charge and refund',
      }, storage)();

      const result = await intentHandler.suggestFromDescription({
        description: 'process a payment',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const suggested = JSON.parse(result.right.suggested);
        expect(suggested).toContain('payment');
      }
    });

    it('should return empty suggestions for unrelated description', async () => {
      const storage = createTestStorage();
      const result = await intentHandler.suggestFromDescription({
        description: 'xyzzy plugh',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const suggested = JSON.parse(result.right.suggested);
        expect(suggested).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await intentHandler.suggestFromDescription({
        description: 'x',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
