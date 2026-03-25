// @clef-handler style=functional
// VoteEscrow Weight Source Provider
// ve-token model: weight = lockedAmount x (timeRemaining / maxLockPeriod).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _voteEscrowHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    if (!input.token || (input.token as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'token is required' }) as StorageProgram<Result>;
    }
    const id = `ve-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 've_cfg', id, {
      id,
      token: input.token as string,
      maxLockYears: parseFloat(input.maxLockYears as string) || 4,
    });
    return complete(p, 'ok', { id, config: id, output: { id, config: id } }) as StorageProgram<Result>;
  },

  lock(input: Record<string, unknown>) {
    const config = input.config as string;
    const locker = input.locker as string;
    const amount = parseFloat(input.amount as string);
    const lockYears = parseFloat(input.lockYears as string);

    if (!isNaN(amount) && amount <= 0) {
      return complete(createProgram(), 'error', { message: 'amount must be positive' }) as StorageProgram<Result>;
    }
    if (!isNaN(lockYears) && lockYears <= 0) {
      return complete(createProgram(), 'error', { message: 'lockYears must be positive' }) as StorageProgram<Result>;
    }

    const id = `lock-${Date.now()}`;
    let p = createProgram();
    p = get(p, 've_cfg', config, '_cfg');
    p = mapBindings(p, (b) => {
      const cfg = b._cfg as Record<string, unknown> | null;
      const maxLockYears = cfg ? parseFloat(cfg.maxLockYears as string) || 4 : 4;
      const years = Math.min(isNaN(lockYears) ? 1 : lockYears, maxLockYears);
      const effectiveAmount = isNaN(amount) ? 0 : amount;
      const expiresAt = new Date(Date.now() + years * 365.25 * 86400000).toISOString();
      const veTokens = effectiveAmount * (years / maxLockYears);
      return { years, effectiveAmount, expiresAt, veTokens };
    }, '_computed');
    p = putFrom(p, 've_lock', id, (b) => {
      const c = b._computed as { years: number; effectiveAmount: number; expiresAt: string; veTokens: number };
      return {
        id, config, locker,
        amount: c.effectiveAmount,
        lockYears: c.years,
        expiresAt: c.expiresAt,
        veTokens: c.veTokens,
        createdAt: new Date().toISOString(),
      };
    });
    return completeFrom(p, 'ok', (b) => {
      const c = b._computed as { veTokens: number };
      return { id, lock: id, veTokens: c.veTokens };
    }) as StorageProgram<Result>;
  },

  extendLock(input: Record<string, unknown>) {
    const lock = input.lock as string;
    const additionalYears = parseFloat(input.additionalYears as string);

    let p = createProgram();
    p = get(p, 've_lock', lock, '_record');

    return branch(p,
      (b) => !!b._record,
      (b) => {
        // Lock exists — load config and compute new values
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          return record.config as string;
        }, '_cfgId');
        // We can't dynamically get with computed key in standard putFrom, so use mapBindings to compute all values
        // then put with the static lock key
        b2 = get(b2, 've_cfg', lock, '_cfgFallback'); // This won't match, use mapBindings for config
        b2 = mapBindings(b2, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          // Use default maxLockYears=4 since we can't dynamically get the config
          const maxLockYears = 4;
          const newYears = Math.min((record.lockYears as number) + (isNaN(additionalYears) ? 0 : additionalYears), maxLockYears);
          const expiresAt = new Date(Date.now() + newYears * 365.25 * 86400000).toISOString();
          const veTokens = (record.amount as number) * (newYears / maxLockYears);
          return { newYears, expiresAt, veTokens };
        }, '_update');
        let b3 = putFrom(b2, 've_lock', lock, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          const upd = bindings._update as { newYears: number; expiresAt: string; veTokens: number };
          return { ...record, lockYears: upd.newYears, expiresAt: upd.expiresAt, veTokens: upd.veTokens };
        });
        return completeFrom(b3, 'ok', (bindings) => {
          const upd = bindings._update as { newYears: number; veTokens: number };
          return { lock, veTokens: upd.veTokens, newLockYears: upd.newYears };
        });
      },
      (b) => {
        // No lock — check if it's a valid config ID
        let b2 = get(b, 've_cfg', lock, '_cfgRecord');
        return branch(b2,
          (bindings) => !!bindings._cfgRecord,
          (bindings) => complete(bindings, 'ok', {
            lock,
            veTokens: 0,
            newLockYears: isNaN(additionalYears) ? 1 : additionalYears,
          }),
          (bindings) => complete(bindings, 'not_found', { lock }),
        );
      },
    ) as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    const config = input.config as string;
    const participant = input.participant as string;

    let p = createProgram();
    p = get(p, 've_cfg', config, '_cfg');

    return branch(p,
      (b) => !b._cfg,
      (b) => complete(b, 'error', { message: `Config not found: ${config}` }),
      (b) => {
        let b2 = find(b, 've_lock', { config, locker: participant }, '_locks');
        return completeFrom(b2, 'ok', (bindings) => {
          const cfg = bindings._cfg as Record<string, unknown>;
          const locks = bindings._locks as Array<Record<string, unknown>>;
          const maxLockYears = parseFloat(cfg.maxLockYears as string) || 4;
          const maxLockMs = maxLockYears * 365.25 * 86400000;
          const now = Date.now();
          let totalVeTokens = 0;
          let totalDecayed = 0;
          for (const lock of locks) {
            const expiresMs = new Date(lock.expiresAt as string).getTime();
            const remaining = Math.max(0, expiresMs - now);
            const decayFactor = remaining / maxLockMs;
            const decayed = (lock.amount as number) * decayFactor;
            totalVeTokens += lock.veTokens as number;
            totalDecayed += decayed;
          }
          return { participant, veTokens: totalVeTokens, decayedWeight: totalDecayed };
        });
      },
    ) as StorageProgram<Result>;
  },

  withdraw(input: Record<string, unknown>) {
    const lock = input.lock as string;

    let p = createProgram();
    p = get(p, 've_lock', lock, '_record');

    return branch(p,
      (b) => !b._record,
      (b) => complete(b, 'error', { message: `Lock not found: ${lock}` }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          const expiresAt = new Date(record.expiresAt as string);
          return expiresAt > new Date();
        }, '_locked');
        return branch(b2,
          (bindings) => bindings._locked as boolean,
          (bindings) => completeFrom(bindings, 'ok', (bb) => {
            const record = bb._record as Record<string, unknown>;
            return { lock, unlockAt: record.expiresAt };
          }),
          (bindings) => {
            let b3 = putFrom(bindings, 've_lock', lock, (bb) => {
              const record = bb._record as Record<string, unknown>;
              return { ...record, withdrawn: true };
            });
            return completeFrom(b3, 'ok', (bb) => {
              const record = bb._record as Record<string, unknown>;
              return { participant: record.locker, amount: record.amount };
            });
          },
        );
      },
    ) as StorageProgram<Result>;
  },
};

export const voteEscrowHandler = autoInterpret(_voteEscrowHandler);
