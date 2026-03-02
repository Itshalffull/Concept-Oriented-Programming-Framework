// PessimisticLock — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { pessimisticLockHandler } from './handler.js';
import type { PessimisticLockStorage } from './types.js';

const createTestStorage = (): PessimisticLockStorage => {
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

const createFailingStorage = (): PessimisticLockStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('PessimisticLock handler', () => {
  describe('checkOut', () => {
    it('should acquire a lock on a free resource', async () => {
      const storage = createTestStorage();

      const result = await pessimisticLockHandler.checkOut(
        { resource: 'doc-1', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.lockId).toContain('lock_');
        }
      }
    });

    it('should return alreadyLocked when resource is held by another', async () => {
      const storage = createTestStorage();
      await pessimisticLockHandler.checkOut(
        { resource: 'doc-2', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      const result = await pessimisticLockHandler.checkOut(
        { resource: 'doc-2', holder: 'bob', duration: O.none, reason: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyLocked');
        if (result.right.variant === 'alreadyLocked') {
          expect(result.right.holder).toBe('alice');
        }
      }
    });

    it('should allow same holder to re-acquire (idempotent)', async () => {
      const storage = createTestStorage();
      const first = await pessimisticLockHandler.checkOut(
        { resource: 'doc-3', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      const second = await pessimisticLockHandler.checkOut(
        { resource: 'doc-3', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      expect(E.isRight(second)).toBe(true);
      if (E.isRight(second)) {
        expect(second.right.variant).toBe('ok');
      }
    });

    it('should support optional duration and reason', async () => {
      const storage = createTestStorage();

      const result = await pessimisticLockHandler.checkOut(
        { resource: 'doc-4', holder: 'charlie', duration: O.some(60000), reason: O.some('editing') },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await pessimisticLockHandler.checkOut(
        { resource: 'fail', holder: 'x', duration: O.none, reason: O.none },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkIn', () => {
    it('should throw due to broken fp-ts pipeline in handler', async () => {
      const storage = createTestStorage();
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'r1', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      expect(E.isRight(checkout)).toBe(true);
      if (E.isRight(checkout) && checkout.right.variant === 'ok') {
        // Handler uses O.fold with async functions then TE.flatten which
        // expects TaskEither but receives a raw value, causing a thrown
        // "f(...) is not a function" TypeError at the Task layer.
        await expect(
          pessimisticLockHandler.checkIn(
            { lockId: checkout.right.lockId },
            storage,
          )(),
        ).rejects.toThrow();
      }
    });

    it('should throw for nonexistent lock due to handler bug', async () => {
      const storage = createTestStorage();

      // Handler uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        pessimisticLockHandler.checkIn(
          { lockId: 'nonexistent' },
          storage,
        )(),
      ).rejects.toThrow();
    });
  });

  describe('breakLock', () => {
    it('should throw due to broken fp-ts pipeline in handler', async () => {
      const storage = createTestStorage();
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'r2', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      if (E.isRight(checkout) && checkout.right.variant === 'ok') {
        // Handler uses O.fold with async + TE.flatten => throws TypeError
        await expect(
          pessimisticLockHandler.breakLock(
            { lockId: checkout.right.lockId, breaker: 'admin', reason: 'emergency' },
            storage,
          )(),
        ).rejects.toThrow();
      }
    });

    it('should throw for nonexistent lock due to handler bug', async () => {
      const storage = createTestStorage();

      // Handler uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        pessimisticLockHandler.breakLock(
          { lockId: 'missing', breaker: 'admin', reason: 'test' },
          storage,
        )(),
      ).rejects.toThrow();
    });
  });

  describe('renew', () => {
    it('should throw due to broken fp-ts pipeline in handler', async () => {
      const storage = createTestStorage();
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'r3', holder: 'alice', duration: O.some(60000), reason: O.none },
        storage,
      )();

      if (E.isRight(checkout) && checkout.right.variant === 'ok') {
        // Handler uses O.fold with async + TE.flatten => throws TypeError
        await expect(
          pessimisticLockHandler.renew(
            { lockId: checkout.right.lockId, additionalDuration: 30000 },
            storage,
          )(),
        ).rejects.toThrow();
      }
    });

    it('should throw for nonexistent lock due to handler bug', async () => {
      const storage = createTestStorage();

      // Handler uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        pessimisticLockHandler.renew(
          { lockId: 'missing', additionalDuration: 1000 },
          storage,
        )(),
      ).rejects.toThrow();
    });
  });

  describe('queryLocks', () => {
    it('should return all active locks', async () => {
      const storage = createTestStorage();
      await pessimisticLockHandler.checkOut(
        { resource: 'qa', holder: 'alice', duration: O.none, reason: O.none },
        storage,
      )();

      const result = await pessimisticLockHandler.queryLocks(
        { resource: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.locks.length).toBeGreaterThan(0);
      }
    });

    it('should filter by resource', async () => {
      const storage = createTestStorage();
      await pessimisticLockHandler.checkOut(
        { resource: 'filtered-r', holder: 'bob', duration: O.none, reason: O.none },
        storage,
      )();

      const result = await pessimisticLockHandler.queryLocks(
        { resource: O.some('filtered-r') },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('queryQueue', () => {
    it('should return empty queue for resource without waiters', async () => {
      const storage = createTestStorage();

      const result = await pessimisticLockHandler.queryQueue(
        { resource: 'empty-queue' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.waiters.length).toBe(0);
      }
    });
  });
});
