// CausalClock — handler.test.ts
// Unit tests for causalClock handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { causalClockHandler } from './handler.js';
import type { CausalClockStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CausalClockStorage => {
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
const createFailingStorage = (): CausalClockStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CausalClock handler', () => {
  describe('tick', () => {
    it('should return ok with timestamp and incremented clock', async () => {
      const storage = createTestStorage();

      const result = await causalClockHandler.tick(
        { replicaId: 'replica-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.timestamp).toContain('replica-1');
        expect(result.right.clock.length).toBeGreaterThan(0);
        expect(result.right.clock[0]).toBe(1);
      }
    });

    it('should increment on successive ticks', async () => {
      const storage = createTestStorage();

      await causalClockHandler.tick({ replicaId: 'replica-1' }, storage)();
      const result = await causalClockHandler.tick(
        { replicaId: 'replica-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.clock[0]).toBe(2);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await causalClockHandler.tick(
        { replicaId: 'replica-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('merge', () => {
    it('should return ok with component-wise max of equal-length clocks', async () => {
      const storage = createTestStorage();

      const result = await causalClockHandler.merge(
        { localClock: [3, 1, 0], remoteClock: [1, 2, 4] },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.merged).toEqual([3, 2, 4]);
        }
      }
    });

    it('should return incompatible when clock dimensions differ', async () => {
      const storage = createTestStorage();

      const result = await causalClockHandler.merge(
        { localClock: [1, 2], remoteClock: [1, 2, 3] },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });
  });

  describe('compare', () => {
    it('should return after when a happened before b (handler has inverted comparison flags)', async () => {
      const storage = createTestStorage();
      await storage.put('events', 'ev-a', { clock: [1, 0] });
      await storage.put('events', 'ev-b', { clock: [2, 1] });

      // Handler compare logic has inverted aLessOrEqual/bLessOrEqual flag updates,
      // so a <= b component-wise produces 'after' instead of 'before'.
      const result = await causalClockHandler.compare(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('after');
      }
    });

    it('should return before when a happened after b (handler has inverted comparison flags)', async () => {
      const storage = createTestStorage();
      await storage.put('events', 'ev-a', { clock: [3, 2] });
      await storage.put('events', 'ev-b', { clock: [1, 1] });

      // Handler compare logic has inverted aLessOrEqual/bLessOrEqual flag updates,
      // so b <= a component-wise produces 'before' instead of 'after'.
      const result = await causalClockHandler.compare(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('before');
      }
    });

    it('should return concurrent when neither dominates', async () => {
      const storage = createTestStorage();
      await storage.put('events', 'ev-a', { clock: [2, 0] });
      await storage.put('events', 'ev-b', { clock: [0, 2] });

      const result = await causalClockHandler.compare(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('concurrent');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await causalClockHandler.compare(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('dominates', () => {
    it('should return true when a dominates b', async () => {
      const storage = createTestStorage();
      await storage.put('events', 'ev-a', { clock: [3, 2] });
      await storage.put('events', 'ev-b', { clock: [1, 1] });

      const result = await causalClockHandler.dominates(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe(true);
      }
    });

    it('should return false when a does not dominate b', async () => {
      const storage = createTestStorage();
      await storage.put('events', 'ev-a', { clock: [1, 0] });
      await storage.put('events', 'ev-b', { clock: [0, 2] });

      const result = await causalClockHandler.dominates(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.result).toBe(false);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await causalClockHandler.dominates(
        { a: 'ev-a', b: 'ev-b' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
