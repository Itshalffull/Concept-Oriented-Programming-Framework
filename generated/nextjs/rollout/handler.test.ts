// Rollout — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { rolloutHandler } from './handler.js';
import type { RolloutStorage } from './types.js';

const createTestStorage = (): RolloutStorage => {
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

const createFailingStorage = (): RolloutStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = rolloutHandler;

describe('Rollout handler', () => {
  describe('begin', () => {
    it('should begin a rollout with a valid strategy', async () => {
      const storage = createTestStorage();
      const result = await handler.begin(
        { plan: 'deploy-v2', strategy: 'canary', steps: ['10%', '50%', '100%'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.rollout).toContain('rollout-');
        }
      }
    });

    it('should reject invalid strategy', async () => {
      const storage = createTestStorage();
      const result = await handler.begin(
        { plan: 'deploy-v2', strategy: 'invalid-strategy', steps: ['10%'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidStrategy');
      }
    });

    it('should reject empty steps', async () => {
      const storage = createTestStorage();
      const result = await handler.begin(
        { plan: 'deploy-v2', strategy: 'canary', steps: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidStrategy');
      }
    });
  });

  describe('advance', () => {
    it('should advance through steps', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'linear', steps: ['25%', '50%', '100%'] },
        storage,
      )();
      expect(E.isRight(beginResult)).toBe(true);
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';

      const result = await handler.advance({ rollout: rolloutId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant === 'ok' || result.right.variant === 'complete').toBe(true);
      }
    });

    it('should return paused when rollout is paused', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'canary', steps: ['25%', '50%', '100%'] },
        storage,
      )();
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';
      await handler.pause({ rollout: rolloutId, reason: 'observing metrics' }, storage)();

      const result = await handler.advance({ rollout: rolloutId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('paused');
      }
    });

    it('should return left for non-existent rollout', async () => {
      const storage = createTestStorage();
      const result = await handler.advance({ rollout: 'nonexistent' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('pause', () => {
    it('should pause an active rollout', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'canary', steps: ['50%', '100%'] },
        storage,
      )();
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';
      const result = await handler.pause({ rollout: rolloutId, reason: 'incident' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('resume', () => {
    it('should resume a paused rollout', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'canary', steps: ['50%', '100%'] },
        storage,
      )();
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';
      await handler.pause({ rollout: rolloutId, reason: 'test' }, storage)();
      const result = await handler.resume({ rollout: rolloutId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('abort', () => {
    it('should abort an active rollout', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'canary', steps: ['50%', '100%'] },
        storage,
      )();
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';
      const result = await handler.abort({ rollout: rolloutId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return alreadyComplete for completed rollout', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'canary', steps: ['100%'] },
        storage,
      )();
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';
      // Advance to completion
      await handler.advance({ rollout: rolloutId }, storage)();
      const result = await handler.abort({ rollout: rolloutId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyComplete');
      }
    });
  });

  describe('status', () => {
    it('should return status for an existing rollout', async () => {
      const storage = createTestStorage();
      const beginResult = await handler.begin(
        { plan: 'test', strategy: 'canary', steps: ['50%', '100%'] },
        storage,
      )();
      const rolloutId = E.isRight(beginResult) && beginResult.right.variant === 'ok' ? beginResult.right.rollout : '';
      const result = await handler.status({ rollout: rolloutId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.status).toBe('active');
      }
    });

    it('should return left for non-existent rollout', async () => {
      const storage = createTestStorage();
      const result = await handler.status({ rollout: 'nonexistent' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
