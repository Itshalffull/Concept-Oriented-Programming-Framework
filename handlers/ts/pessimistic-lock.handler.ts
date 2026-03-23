// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
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

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, delFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `pessimistic-lock-${++idCounter}`;
}

/**
 * Check whether a lock has expired based on its expires timestamp.
 */
function isExpired(expiresIso: string | null | undefined): boolean {
  if (!expiresIso) return false;
  return new Date(expiresIso).getTime() <= Date.now();
}

const _handler: FunctionalConceptHandler = {
  checkOut(input: Record<string, unknown>) {
    if (!input.resource || (typeof input.resource === 'string' && (input.resource as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'resource is required' }) as StorageProgram<Result>;
    }
    const resource = input.resource as string;
    const holder = input.holder as string;
    const duration = input.duration as number | undefined;
    const reason = input.reason as string | undefined;

    let p = createProgram();
    p = find(p, 'pessimistic-lock', { resource }, 'existing');
    p = find(p, 'pessimistic-lock-queue', { resource }, 'queueRecords');

    // Compute the action to take
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      const queueRecords = bindings.queueRecords as Record<string, unknown>[];
      const activeLock = existing.find((lock) => !isExpired(lock.expires as string | null));

      if (activeLock) {
        if (activeLock.holder === holder) {
          return { action: 'existingLock', lockId: activeLock.id as string };
        }
        const alreadyQueued = queueRecords.find((q) => q.requester === holder);
        if (!alreadyQueued) {
          return { action: 'enqueue', position: queueRecords.length + 1 };
        }
        return {
          action: 'alreadyLocked',
          holder: activeLock.holder as string,
          expires: (activeLock.expires as string | null) ?? undefined,
        };
      }

      return { action: 'grant' };
    }, 'decision');

    // Enqueue if needed
    p = branch(p,
      (bindings) => (bindings.decision as Record<string, unknown>).action === 'enqueue',
      (bp) => {
        const queueId = `queue-${nextId()}`;
        const bp2 = put(bp, 'pessimistic-lock-queue', queueId, {
          id: queueId, resource, requester: holder,
          requested: new Date().toISOString(),
        });
        return completeFrom(bp2, 'queued', (bindings) => ({
          position: (bindings.decision as Record<string, unknown>).position as number,
        }));
      },
      (bp) => branch(bp,
        (bindings) => (bindings.decision as Record<string, unknown>).action === 'existingLock',
        (bp2) => completeFrom(bp2, 'ok', (bindings) => ({
          lockId: (bindings.decision as Record<string, unknown>).lockId as string,
        })),
        (bp2) => branch(bp2,
          (bindings) => (bindings.decision as Record<string, unknown>).action === 'alreadyLocked',
          (bp3) => completeFrom(bp3, 'alreadyLocked', (bindings) => {
            const d = bindings.decision as Record<string, unknown>;
            return { holder: d.holder as string, expires: d.expires };
          }),
          (bp3) => {
            // Grant the lock
            const lockId = nextId();
            const acquired = new Date().toISOString();
            const expires = duration
              ? new Date(Date.now() + duration * 1000).toISOString()
              : null;

            let bp4 = put(bp3, 'pessimistic-lock', lockId, {
              id: lockId, resource, holder, acquired, expires,
              reason: reason ?? null,
            });

            // Remove holder from queue if they were queued
            bp4 = find(bp4, 'pessimistic-lock-queue', { resource, requester: holder }, 'holderQueueRecords');
            bp4 = delFrom(bp4, 'pessimistic-lock-queue', (bindings) => {
              const qrs = bindings.holderQueueRecords as Record<string, unknown>[];
              if (qrs.length > 0) return qrs[0].id as string;
              return '__nonexistent__';
            });

            return complete(bp4, 'ok', { lockId });
          },
        ),
      ),
    ) as StorageProgram<Result>;

    return p as StorageProgram<Result>;
  },

  checkIn(input: Record<string, unknown>) {
    const lockId = input.lockId as string;

    let p = createProgram();
    p = get(p, 'pessimistic-lock', lockId, 'lock');

    return branch(p,
      (bindings) => !bindings.lock,
      (bp) => complete(bp, 'notFound', { message: `Lock "${lockId}" not found` }),
      (bp) => {
        const bp2 = del(bp, 'pessimistic-lock', lockId);
        return complete(bp2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

  breakLock(input: Record<string, unknown>) {
    const lockId = input.lockId as string;

    let p = createProgram();
    p = get(p, 'pessimistic-lock', lockId, 'lock');

    return branch(p,
      (bindings) => !bindings.lock,
      (bp) => complete(bp, 'notFound', { message: `Lock "${lockId}" not found` }),
      (bp) => {
        const bp2 = del(bp, 'pessimistic-lock', lockId);
        return completeFrom(bp2, 'ok', (bindings) => ({
          previousHolder: (bindings.lock as Record<string, unknown>).holder as string,
        }));
      },
    ) as StorageProgram<Result>;
  },

  renew(input: Record<string, unknown>) {
    const lockId = input.lockId as string;
    const additionalDuration = input.additionalDuration as number;

    let p = createProgram();
    p = get(p, 'pessimistic-lock', lockId, 'lock');

    return branch(p,
      (bindings) => !bindings.lock,
      (bp) => complete(bp, 'notFound', { message: `Lock "${lockId}" not found` }),
      (bp) => {
        const bp2 = putFrom(bp, 'pessimistic-lock', lockId, (bindings) => {
          const lock = bindings.lock as Record<string, unknown>;
          const currentExpires = lock.expires
            ? new Date(lock.expires as string).getTime()
            : Date.now();
          const base = Math.max(currentExpires, Date.now());
          const newExpires = new Date(base + additionalDuration * 1000).toISOString();
          return { ...lock, expires: newExpires };
        });
        return completeFrom(bp2, 'ok', (bindings) => {
          const lock = bindings.lock as Record<string, unknown>;
          const currentExpires = lock.expires
            ? new Date(lock.expires as string).getTime()
            : Date.now();
          const base = Math.max(currentExpires, Date.now());
          const newExpires = new Date(base + additionalDuration * 1000).toISOString();
          return { newExpires };
        });
      },
    ) as StorageProgram<Result>;
  },

  queryLocks(input: Record<string, unknown>) {
    const resource = input.resource as string | undefined;

    const criteria: Record<string, unknown> = {};
    if (resource !== undefined && resource !== '') {
      criteria.resource = resource;
    }

    let p = createProgram();
    p = find(p, 'pessimistic-lock',
      Object.keys(criteria).length > 0 ? criteria : {},
      'results');

    return completeFrom(p, 'ok', (bindings) => {
      const results = bindings.results as Record<string, unknown>[];
      const activeLocks = results.filter((lock) => !isExpired(lock.expires as string | null));
      return { locks: activeLocks.map((l) => l.id as string) };
    }) as StorageProgram<Result>;
  },

  queryQueue(input: Record<string, unknown>) {
    if (!input.resource || (typeof input.resource === 'string' && (input.resource as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'resource is required' }) as StorageProgram<Result>;
    }
    const resource = input.resource as string;

    let p = createProgram();
    p = find(p, 'pessimistic-lock-queue', { resource }, 'results');

    return completeFrom(p, 'ok', (bindings) => {
      const results = bindings.results as Record<string, unknown>[];
      const waiters = results.map((q) => ({
        requester: q.requester as string,
        requested: q.requested as string,
      }));
      return { waiters };
    }) as StorageProgram<Result>;
  },
};

export const pessimisticLockHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetPessimisticLockCounter(): void {
  idCounter = 0;
}
