// ActionEntity — handler.test.ts
// Unit tests for actionEntity handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { actionEntityHandler } from './handler.js';
import type { ActionEntityStorage } from './types.js';

const createTestStorage = (): ActionEntityStorage => {
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

const createFailingStorage = (): ActionEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ActionEntity handler', () => {
  describe('register', () => {
    it('registers successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionEntityHandler.register(
        { concept: 'user', name: 'create', params: '{}', variantRefs: '["ok","error"]' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.action).toBe('action_user_create');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.register(
        { concept: 'user', name: 'create', params: '{}', variantRefs: '[]' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByConcept', () => {
    it('returns results after register', async () => {
      const storage = createTestStorage();
      await actionEntityHandler.register(
        { concept: 'user', name: 'create', params: '{}', variantRefs: '["ok"]' },
        storage,
      )();
      const result = await actionEntityHandler.findByConcept(
        { concept: 'user' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const actions = JSON.parse(result.right.actions);
        expect(actions.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.findByConcept(
        { concept: 'user' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('triggeringSyncs', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionEntityHandler.triggeringSyncs(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.triggeringSyncs(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invokingSyncs', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionEntityHandler.invokingSyncs(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.invokingSyncs(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('implementations', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionEntityHandler.implementations(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.implementations(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('interfaceExposures', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionEntityHandler.interfaceExposures(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.interfaceExposures(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns notfound for missing entity', async () => {
      const storage = createTestStorage();
      const result = await actionEntityHandler.get(
        { action: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns entity after register', async () => {
      const storage = createTestStorage();
      await actionEntityHandler.register(
        { concept: 'user', name: 'create', params: '{"id":"string"}', variantRefs: '["ok","error"]' },
        storage,
      )();
      const result = await actionEntityHandler.get(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.concept).toBe('user');
          expect(result.right.name).toBe('create');
          expect(result.right.variantCount).toBe(2);
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionEntityHandler.get(
        { action: 'action_user_create' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
