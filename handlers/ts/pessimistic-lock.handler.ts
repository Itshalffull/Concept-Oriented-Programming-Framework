// ============================================================
// PessimisticLock Handler
//
// Prevent conflicts by granting exclusive write access to a
// resource, serializing edits rather than reconciling them after
// the fact. Complementary to ConflictResolution — use locking for
// non-mergeable content (binary files, legal documents) and
// resolution for mergeable content (text, structured data).
// checkOut may complete after an arbitrarily long wait if the
// resource is locked and the requester is queued.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `pessimistic-lock-${++idCounter}`;
}

/**
 * Check whether a lock has expired based on its expires timestamp.
 * Returns true if the lock is past its expiry time.
 */
function isExpired(expiresIso: string | null | undefined): boolean {
  if (!expiresIso) return false;
  return new Date(expiresIso).getTime() <= Date.now();
}

export const pessimisticLockHandler: ConceptHandler = {
  async checkOut(input: Record<string, unknown>, storage: ConceptStorage) {
    const resource = input.resource as string;
    const holder = input.holder as string;
    const duration = input.duration as number | undefined;
    const reason = input.reason as string | undefined;

    // Check for an existing active lock on this resource
    const existing = await storage.find('pessimistic-lock', { resource });
    const activeLock = existing.find((lock) => !isExpired(lock.expires as string | null));

    if (activeLock) {
      // If the same holder already holds it, return their existing lock
      if (activeLock.holder === holder) {
        return { variant: 'ok', lockId: activeLock.id as string };
      }

      // Resource is held by another user — check the queue or add to it
      const queueRecords = await storage.find('pessimistic-lock-queue', { resource });
      const alreadyQueued = queueRecords.find((q) => q.requester === holder);

      if (!alreadyQueued) {
        const queueId = `queue-${nextId()}`;
        await storage.put('pessimistic-lock-queue', queueId, {
          id: queueId,
          resource,
          requester: holder,
          requested: new Date().toISOString(),
        });
        return { variant: 'queued', position: queueRecords.length + 1 };
      }

      return {
        variant: 'alreadyLocked',
        holder: activeLock.holder as string,
        expires: (activeLock.expires as string | null) ?? undefined,
      };
    }

    // Clean up any expired locks for this resource
    for (const lock of existing) {
      if (isExpired(lock.expires as string | null)) {
        await storage.del('pessimistic-lock', lock.id as string);
      }
    }

    // Grant the lock
    const lockId = nextId();
    const acquired = new Date().toISOString();
    const expires = duration
      ? new Date(Date.now() + duration * 1000).toISOString()
      : null;

    await storage.put('pessimistic-lock', lockId, {
      id: lockId,
      resource,
      holder,
      acquired,
      expires,
      reason: reason ?? null,
    });

    // Remove this holder from the queue if they were queued
    const queueRecords = await storage.find('pessimistic-lock-queue', { resource, requester: holder });
    for (const qr of queueRecords) {
      await storage.del('pessimistic-lock-queue', qr.id as string);
    }

    return { variant: 'ok', lockId };
  },

  async checkIn(input: Record<string, unknown>, storage: ConceptStorage) {
    const lockId = input.lockId as string;

    const lock = await storage.get('pessimistic-lock', lockId);
    if (!lock) {
      return { variant: 'notFound', message: `Lock "${lockId}" not found` };
    }

    // Release the lock
    await storage.del('pessimistic-lock', lockId);

    return { variant: 'ok' };
  },

  async breakLock(input: Record<string, unknown>, storage: ConceptStorage) {
    const lockId = input.lockId as string;
    const breaker = input.breaker as string;
    const reason = input.reason as string;

    const lock = await storage.get('pessimistic-lock', lockId);
    if (!lock) {
      return { variant: 'notFound', message: `Lock "${lockId}" not found` };
    }

    const previousHolder = lock.holder as string;

    // Record the break reason and remove the lock
    await storage.del('pessimistic-lock', lockId);

    return { variant: 'ok', previousHolder };
  },

  async renew(input: Record<string, unknown>, storage: ConceptStorage) {
    const lockId = input.lockId as string;
    const additionalDuration = input.additionalDuration as number;

    const lock = await storage.get('pessimistic-lock', lockId);
    if (!lock) {
      return { variant: 'notFound', message: `Lock "${lockId}" not found` };
    }

    // Extend expiry from current time or from existing expiry, whichever is later
    const currentExpires = lock.expires
      ? new Date(lock.expires as string).getTime()
      : Date.now();
    const base = Math.max(currentExpires, Date.now());
    const newExpires = new Date(base + additionalDuration * 1000).toISOString();

    await storage.put('pessimistic-lock', lockId, {
      ...lock,
      expires: newExpires,
    });

    return { variant: 'ok', newExpires };
  },

  async queryLocks(input: Record<string, unknown>, storage: ConceptStorage) {
    const resource = input.resource as string | undefined;

    const criteria: Record<string, unknown> = {};
    if (resource !== undefined && resource !== '') {
      criteria.resource = resource;
    }

    const results = await storage.find(
      'pessimistic-lock',
      Object.keys(criteria).length > 0 ? criteria : undefined,
    );

    // Filter out expired locks
    const activeLocks = results.filter((lock) => !isExpired(lock.expires as string | null));

    return { variant: 'ok', locks: activeLocks.map((l) => l.id as string) };
  },

  async queryQueue(input: Record<string, unknown>, storage: ConceptStorage) {
    const resource = input.resource as string;

    const results = await storage.find('pessimistic-lock-queue', { resource });

    const waiters = results.map((q) => ({
      requester: q.requester as string,
      requested: q.requested as string,
    }));

    return { variant: 'ok', waiters };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetPessimisticLockCounter(): void {
  idCounter = 0;
}
