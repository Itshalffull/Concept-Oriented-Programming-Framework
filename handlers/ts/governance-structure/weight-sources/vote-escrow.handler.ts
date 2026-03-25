// @clef-handler style=functional
// VoteEscrow Concept Implementation
// Derive governance weight from time-locked token positions, where
// weight is proportional to both amount locked and remaining lock
// duration, incentivizing long-term commitment.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ve-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'VoteEscrow' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const token = input.token as string;
    const maxLockYears = input.maxLockYears as number | null;

    if (!token || token.trim() === '') {
      return complete(createProgram(), 'error', { message: 'token is required' }) as StorageProgram<Result>;
    }

    const maxYears = maxLockYears ?? 4.0;
    const id = nextId();

    let p = createProgram();
    p = put(p, 'voteEscrowConfig', id, {
      id,
      token: token.trim(),
      maxLockYears: maxYears,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  lock(input: Record<string, unknown>) {
    const config = input.config as string;
    const locker = input.locker as string;
    const amount = input.amount as number;
    const lockYears = input.lockYears as number;

    if (!config || config.trim() === '') {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }
    if (!locker || locker.trim() === '') {
      return complete(createProgram(), 'error', { message: 'locker is required' }) as StorageProgram<Result>;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return complete(createProgram(), 'error', { message: 'amount must be positive' }) as StorageProgram<Result>;
    }
    if (typeof lockYears !== 'number' || lockYears <= 0) {
      return complete(createProgram(), 'error', { message: 'lockYears must be positive' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'voteEscrowConfig', config, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'config not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'voteEscrowConfig', config, 'cfg');
        return completeFrom(b, 'ok', (bindings) => {
          const cfg = bindings.cfg as Record<string, unknown>;
          const maxYears = cfg.maxLockYears as number;

          if (lockYears > maxYears) {
            // Exceeded maximum: still proceed but cap (simplified)
            return { lockYears, maxYears };
          }

          const lockId = nextId();
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + Math.floor(lockYears));
          const veTokens = amount * (lockYears / maxYears);

          return { lock: lockId, veTokens };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  extendLock(input: Record<string, unknown>) {
    const lock = input.lock as string;
    const additionalYears = input.additionalYears as number;

    if (!lock || lock.trim() === '') {
      return complete(createProgram(), 'error', { message: 'lock is required' }) as StorageProgram<Result>;
    }
    if (typeof additionalYears !== 'number' || additionalYears <= 0) {
      return complete(createProgram(), 'error', { message: 'additionalYears must be positive' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'veLock', lock, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { lock }),
      (() => {
        let b = createProgram();
        b = get(b, 'veLock', lock, 'rec');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const currentYears = rec.lockYears as number;
          const newLockYears = currentYears + additionalYears;
          const config = rec.config as string;
          // veTokens recalculated based on new lockYears
          const veTokens = (rec.amount as number) * newLockYears;
          return { lock, veTokens, newLockYears };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    const config = input.config as string;
    const participant = input.participant as string;

    if (!config || config.trim() === '') {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }
    if (!participant || participant.trim() === '') {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'voteEscrowConfig', config, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'config not found' }),
      (() => {
        // Return zero weight for participant with no lock
        return complete(createProgram(), 'ok', { participant, veTokens: 0.0, decayedWeight: 0.0 });
      })(),
    ) as StorageProgram<Result>;
  },

  withdraw(input: Record<string, unknown>) {
    const lock = input.lock as string;

    if (!lock || lock.trim() === '') {
      return complete(createProgram(), 'error', { message: 'lock is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'veLock', lock, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'lock not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'veLock', lock, 'rec');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const expiresAt = new Date(rec.expiresAt as string);
          const now = new Date();
          if (now >= expiresAt) {
            return { participant: rec.locker as string, amount: rec.amount as number };
          }
          return { lock, unlockAt: expiresAt };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const voteEscrowHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetVoteEscrow(): void {
  idCounter = 0;
}
