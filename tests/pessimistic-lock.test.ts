// ============================================================
// PessimisticLock Concept Handler Tests
//
// Validates checkOut, checkIn, breakLock, renew, queryLocks,
// and queryQueue actions for the collaboration kit's pessimistic
// locking concept. Covers re-acquire by same holder, conflict
// with different holder, TTL expiry, break lock, and queue
// management.
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  pessimisticLockHandler,
  resetPessimisticLockCounter,
} from '../handlers/ts/pessimistic-lock.handler.js';

describe('PessimisticLock', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetPessimisticLockCounter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- checkOut ----

  describe('checkOut', () => {
    it('grants a lock on a free resource', async () => {
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.lockId).toBeDefined();
    });

    it('returns the same lock ID when the same holder re-acquires', async () => {
      const r1 = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      const r2 = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      expect(r2.variant).toBe('ok');
      expect(r2.lockId).toBe(r1.lockId);
    });

    it('queues a different holder when resource is locked', async () => {
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      expect(result.variant).toBe('queued');
      expect(result.position).toBe(1);
    });

    it('returns alreadyLocked when same holder is already queued', async () => {
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      // First attempt queues bob
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      // Second attempt: bob is already queued
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      expect(result.variant).toBe('alreadyLocked');
      expect(result.holder).toBe('alice');
    });

    it('grants lock with a TTL (duration)', async () => {
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice', duration: 60 },
        storage,
      );
      expect(result.variant).toBe('ok');
      // Verify the lock record has an expires field
      const lock = await storage.get('pessimistic-lock', result.lockId as string);
      expect(lock!.expires).not.toBeNull();
    });

    it('grants lock without TTL when duration is not specified', async () => {
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      const lock = await storage.get('pessimistic-lock', result.lockId as string);
      expect(lock!.expires).toBeNull();
    });

    it('stores optional reason', async () => {
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice', reason: 'editing section 3' },
        storage,
      );
      const lock = await storage.get('pessimistic-lock', result.lockId as string);
      expect(lock!.reason).toBe('editing section 3');
    });

    it('grants lock on expired resource (TTL expired)', async () => {
      // Create a lock with a very short TTL that is already expired
      vi.useFakeTimers();
      const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();
      vi.setSystemTime(baseTime);

      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice', duration: 1 },
        storage,
      );

      // Advance past expiry
      vi.setSystemTime(baseTime + 2000);

      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      expect(result.variant).toBe('ok');
      // Bob gets the lock since Alice's expired
    });

    it('removes holder from queue when lock is granted', async () => {
      // alice holds the lock
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      // bob gets queued
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );

      // alice releases
      const locks = await storage.find('pessimistic-lock', { resource: 'file.docx' });
      await pessimisticLockHandler.checkIn(
        { lockId: locks[0].id as string },
        storage,
      );

      // bob checks out - should get the lock now
      const result = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // bob should no longer be in the queue
      const queue = await pessimisticLockHandler.queryQueue(
        { resource: 'file.docx' },
        storage,
      );
      const waiters = queue.waiters as Array<{ requester: string }>;
      expect(waiters.find(w => w.requester === 'bob')).toBeUndefined();
    });
  });

  // ---- checkIn ----

  describe('checkIn', () => {
    it('releases a held lock', async () => {
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      const result = await pessimisticLockHandler.checkIn(
        { lockId: checkout.lockId as string },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify lock is gone
      const lock = await storage.get('pessimistic-lock', checkout.lockId as string);
      expect(lock).toBeNull();
    });

    it('returns notFound for unknown lock ID', async () => {
      const result = await pessimisticLockHandler.checkIn(
        { lockId: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });

  // ---- breakLock ----

  describe('breakLock', () => {
    it('breaks a held lock and returns previous holder', async () => {
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      const result = await pessimisticLockHandler.breakLock(
        { lockId: checkout.lockId as string, breaker: 'admin', reason: 'emergency' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.previousHolder).toBe('alice');

      // Lock should be removed
      const lock = await storage.get('pessimistic-lock', checkout.lockId as string);
      expect(lock).toBeNull();
    });

    it('returns notFound for unknown lock ID', async () => {
      const result = await pessimisticLockHandler.breakLock(
        { lockId: 'ghost', breaker: 'admin', reason: 'test' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });

  // ---- renew ----

  describe('renew', () => {
    it('extends the expiry of an existing lock', async () => {
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice', duration: 60 },
        storage,
      );
      const lockBefore = await storage.get('pessimistic-lock', checkout.lockId as string);
      const expiresBefore = new Date(lockBefore!.expires as string).getTime();

      const result = await pessimisticLockHandler.renew(
        { lockId: checkout.lockId as string, additionalDuration: 120 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.newExpires).toBeDefined();

      const newExpiresMs = new Date(result.newExpires as string).getTime();
      // New expiry should be at least additionalDuration seconds later than old expiry
      expect(newExpiresMs).toBeGreaterThanOrEqual(expiresBefore + 120 * 1000);
    });

    it('renews a lock that has no previous expiry', async () => {
      const checkout = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      const result = await pessimisticLockHandler.renew(
        { lockId: checkout.lockId as string, additionalDuration: 300 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.newExpires).toBeDefined();
    });

    it('returns notFound for unknown lock ID', async () => {
      const result = await pessimisticLockHandler.renew(
        { lockId: 'ghost', additionalDuration: 60 },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });

  // ---- queryLocks ----

  describe('queryLocks', () => {
    it('returns active locks for a specific resource', async () => {
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      await pessimisticLockHandler.checkOut(
        { resource: 'other.txt', holder: 'bob' },
        storage,
      );

      const result = await pessimisticLockHandler.queryLocks(
        { resource: 'file.docx' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.locks as string[]).length).toBe(1);
    });

    it('returns all active locks when no resource filter is given', async () => {
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      await pessimisticLockHandler.checkOut(
        { resource: 'other.txt', holder: 'bob' },
        storage,
      );

      const result = await pessimisticLockHandler.queryLocks({}, storage);
      expect(result.variant).toBe('ok');
      expect((result.locks as string[]).length).toBe(2);
    });

    it('filters out expired locks', async () => {
      vi.useFakeTimers();
      const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();
      vi.setSystemTime(baseTime);

      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice', duration: 1 },
        storage,
      );

      // Advance past expiry
      vi.setSystemTime(baseTime + 2000);

      const result = await pessimisticLockHandler.queryLocks(
        { resource: 'file.docx' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.locks as string[]).length).toBe(0);
    });

    it('returns empty list when no locks exist', async () => {
      const result = await pessimisticLockHandler.queryLocks(
        { resource: 'nothing' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.locks as string[]).length).toBe(0);
    });
  });

  // ---- queryQueue ----

  describe('queryQueue', () => {
    it('returns waiting holders in the queue', async () => {
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );

      const result = await pessimisticLockHandler.queryQueue(
        { resource: 'file.docx' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const waiters = result.waiters as Array<{ requester: string; requested: string }>;
      expect(waiters.length).toBe(1);
      expect(waiters[0].requester).toBe('bob');
      expect(waiters[0].requested).toBeDefined();
    });

    it('returns empty queue when no one is waiting', async () => {
      const result = await pessimisticLockHandler.queryQueue(
        { resource: 'file.docx' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.waiters as unknown[]).length).toBe(0);
    });
  });

  // ---- Multi-step sequences ----

  describe('full lock lifecycle', () => {
    it('checkOut -> renew -> checkIn frees the resource', async () => {
      const co = await pessimisticLockHandler.checkOut(
        { resource: 'report.pdf', holder: 'alice', duration: 300 },
        storage,
      );
      expect(co.variant).toBe('ok');

      const rn = await pessimisticLockHandler.renew(
        { lockId: co.lockId as string, additionalDuration: 600 },
        storage,
      );
      expect(rn.variant).toBe('ok');

      const ci = await pessimisticLockHandler.checkIn(
        { lockId: co.lockId as string },
        storage,
      );
      expect(ci.variant).toBe('ok');

      // Resource is now free
      const locks = await pessimisticLockHandler.queryLocks(
        { resource: 'report.pdf' },
        storage,
      );
      expect((locks.locks as string[]).length).toBe(0);
    });

    it('multiple resources can be locked independently', async () => {
      const co1 = await pessimisticLockHandler.checkOut(
        { resource: 'a.txt', holder: 'alice' },
        storage,
      );
      const co2 = await pessimisticLockHandler.checkOut(
        { resource: 'b.txt', holder: 'alice' },
        storage,
      );
      expect(co1.variant).toBe('ok');
      expect(co2.variant).toBe('ok');
      expect(co1.lockId).not.toBe(co2.lockId);
    });

    it('break lock allows new holder to acquire', async () => {
      const co = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );

      await pessimisticLockHandler.breakLock(
        { lockId: co.lockId as string, breaker: 'admin', reason: 'stale session' },
        storage,
      );

      const co2 = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      expect(co2.variant).toBe('ok');
    });

    it('queue ordering: multiple holders queue in order', async () => {
      await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'alice' },
        storage,
      );

      const q1 = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'bob' },
        storage,
      );
      expect(q1.variant).toBe('queued');
      expect(q1.position).toBe(1);

      const q2 = await pessimisticLockHandler.checkOut(
        { resource: 'file.docx', holder: 'charlie' },
        storage,
      );
      expect(q2.variant).toBe('queued');
      expect(q2.position).toBe(2);

      const queue = await pessimisticLockHandler.queryQueue(
        { resource: 'file.docx' },
        storage,
      );
      const waiters = queue.waiters as Array<{ requester: string }>;
      expect(waiters.length).toBe(2);
      expect(waiters.map(w => w.requester)).toContain('bob');
      expect(waiters.map(w => w.requester)).toContain('charlie');
    });
  });
});
