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
  createProgram, get, find, put, del, branch, complete, completeFrom,
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
 * Returns true if the lock is past its expiry time.
 */
function isExpired(expiresIso: string | null | undefined): boolean {
  if (!expiresIso) return false;
  return new Date(expiresIso).getTime() <= Date.now();
}

const _handler: FunctionalConceptHandler = {
  checkOut(input: Record<string, unknown>) {
    const resource = input.resource as string;
    const holder = input.holder as string;
    const duration = input.duration as number | undefined;
    const reason = input.reason as string | undefined;

    let p = createProgram();
    p = find(p, 'pessimistic-lock', { resource }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      const activeLock = existing.find((lock) => !isExpired(lock.expires as string | null));

      if (activeLock) {
        if (activeLock.holder === holder) {
          return { lockId: activeLock.id as string };
        }

        return {
          variant: 'alreadyLocked',
          holder: activeLock.holder as string,
          expires: (activeLock.expires as string | null) ?? undefined,
        };
      }

      const lockId = nextId();
      const acquired = new Date().toISOString();
      const expires = duration
        ? new Date(Date.now() + duration * 1000).toISOString()
        : null;

      return { lockId };
    }) as StorageProgram<Result>;
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
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const lock = bindings.lock as Record<string, unknown>;
        const currentExpires = lock.expires
          ? new Date(lock.expires as string).getTime()
          : Date.now();
        const base = Math.max(currentExpires, Date.now());
        const newExpires = new Date(base + additionalDuration * 1000).toISOString();
        return { newExpires };
      }),
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
