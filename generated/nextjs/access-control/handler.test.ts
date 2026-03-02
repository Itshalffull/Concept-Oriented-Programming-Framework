// AccessControl — handler.test.ts
// Unit tests for accessControl handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { accessControlHandler } from './handler.js';
import type { AccessControlStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): AccessControlStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): AccessControlStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AccessControl handler', () => {
  describe('check', () => {
    it('produces ok with valid input and no policies', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.check(
        { resource: 'doc:123', action: 'read', context: 'user' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe('neutral');
      }
    });

    it('returns allowed when a matching policy allows', async () => {
      const storage = createTestStorage();
      await storage.put('policies', 'p1', {
        resource: 'doc:123',
        action: 'read',
        result: 'allowed',
        tag: 'policy-a',
        maxAge: 600,
      });
      const result = await accessControlHandler.check(
        { resource: 'doc:123', action: 'read', context: 'user' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe('allowed');
      }
    });

    it('returns forbidden when a matching policy forbids', async () => {
      const storage = createTestStorage();
      await storage.put('policies', 'p1', {
        resource: '*',
        action: '*',
        result: 'forbidden',
        tag: 'deny-all',
        maxAge: 300,
      });
      const result = await accessControlHandler.check(
        { resource: 'doc:123', action: 'write', context: 'anon' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('forbidden');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await accessControlHandler.check(
        { resource: 'doc:123', action: 'read', context: 'user' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('orIf', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.orIf(
        { left: 'allowed', right: 'neutral' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe('allowed');
      }
    });

    it('returns forbidden if either input is forbidden', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.orIf(
        { left: 'allowed', right: 'forbidden' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('forbidden');
      }
    });

    it('returns neutral if both are neutral', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.orIf(
        { left: 'neutral', right: 'neutral' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('neutral');
      }
    });
  });

  describe('andIf', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.andIf(
        { left: 'allowed', right: 'allowed' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe('allowed');
      }
    });

    it('returns neutral if one input is neutral', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.andIf(
        { left: 'allowed', right: 'neutral' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('neutral');
      }
    });

    it('returns forbidden if either input is forbidden', async () => {
      const storage = createTestStorage();
      const result = await accessControlHandler.andIf(
        { left: 'forbidden', right: 'allowed' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.result).toBe('forbidden');
      }
    });
  });
});
