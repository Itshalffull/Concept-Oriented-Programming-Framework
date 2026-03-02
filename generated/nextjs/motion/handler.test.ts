// Motion — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { motionHandler } from './handler.js';
import type { MotionStorage } from './types.js';

const createTestStorage = (): MotionStorage => {
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

const createFailingStorage = (): MotionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = motionHandler;

describe('Motion handler', () => {
  describe('defineDuration', () => {
    it('should define a valid duration token', async () => {
      const storage = createTestStorage();
      const result = await handler.defineDuration(
        { motion: 'default', name: 'fast', ms: 200 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.motion).toBe('default');
        }
      }
    });

    it('should return invalid for negative duration', async () => {
      const storage = createTestStorage();
      const result = await handler.defineDuration(
        { motion: 'default', name: 'bad', ms: -100 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for duration exceeding 10000ms', async () => {
      const storage = createTestStorage();
      const result = await handler.defineDuration(
        { motion: 'default', name: 'slow', ms: 15000 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.defineDuration(
        { motion: 'default', name: '  ', ms: 200 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should accept 0ms duration', async () => {
      const storage = createTestStorage();
      const result = await handler.defineDuration(
        { motion: 'default', name: 'instant', ms: 0 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineDuration(
        { motion: 'default', name: 'fail', ms: 200 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('defineEasing', () => {
    it('should define a CSS keyword easing', async () => {
      const storage = createTestStorage();
      const result = await handler.defineEasing(
        { motion: 'default', name: 'standard', value: 'ease-in-out' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should define a cubic-bezier easing', async () => {
      const storage = createTestStorage();
      const result = await handler.defineEasing(
        { motion: 'default', name: 'custom', value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should define a spring easing', async () => {
      const storage = createTestStorage();
      const result = await handler.defineEasing(
        { motion: 'default', name: 'bouncy', value: 'spring(100, 10, 1)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for unrecognized easing value', async () => {
      const storage = createTestStorage();
      const result = await handler.defineEasing(
        { motion: 'default', name: 'bad', value: 'not-an-easing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.defineEasing(
        { motion: 'default', name: '', value: 'ease' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('defineTransition', () => {
    it('should define a transition with valid config', async () => {
      const storage = createTestStorage();
      const result = await handler.defineTransition(
        {
          motion: 'default',
          name: 'fade',
          config: JSON.stringify({ property: 'opacity', duration: '300ms', easing: 'ease' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for config without property field', async () => {
      const storage = createTestStorage();
      const result = await handler.defineTransition(
        {
          motion: 'default',
          name: 'bad',
          config: JSON.stringify({ duration: '300ms' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left for invalid JSON config', async () => {
      const storage = createTestStorage();
      const result = await handler.defineTransition(
        { motion: 'default', name: 'bad', config: 'not json' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return invalid for non-object config', async () => {
      const storage = createTestStorage();
      const result = await handler.defineTransition(
        { motion: 'default', name: 'array', config: JSON.stringify([1, 2, 3]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });
});
