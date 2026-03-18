// @migrated dsl-constructs 2026-03-18
// VoteEscrow Weight Source Provider
// ve-token model: weight = lockedAmount x (timeRemaining / maxLockPeriod).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _voteEscrowHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `ve-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 've_cfg', id, {
      id,
      token: input.token,
      maxLockYears: input.maxLockYears ?? 4,
    });
    p = put(p, 'plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'VoteEscrow',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  lock(input: Record<string, unknown>) {
    const { config, locker, amount, lockYears } = input;
    let p = createProgram();
    p = get(p, 've_cfg', config as string, 'cfg');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const maxLockYears = cfg ? (cfg.maxLockYears as number) : 4;
      const years = Math.min(lockYears as number, maxLockYears);
      const expiresAt = new Date(Date.now() + years * 365.25 * 86400000).toISOString();
      const veTokens = (amount as number) * (years / maxLockYears);
      return { years, expiresAt, veTokens, maxLockYears };
    }, 'lockParams');

    const id = `lock-${Date.now()}`;
    p = put(p, 've_lock', id, {
      id,
      config,
      locker,
      amount: amount as number,
      lockYears: 0,
      expiresAt: '',
      veTokens: 0,
      createdAt: new Date().toISOString(),
    });

    return completeFrom(p, 'locked', (bindings) => {
      const params = bindings.lockParams as Record<string, unknown>;
      return { lock: id, veTokens: params.veTokens };
    }) as StorageProgram<Result>;
  },

  extendLock(input: Record<string, unknown>) {
    const { lock, additionalYears } = input;
    let p = createProgram();
    p = get(p, 've_lock', lock as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.config;
        }, 'configId');

        b = get(b, 've_cfg', '', 'cfg');

        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const cfg = bindings.cfg as Record<string, unknown> | null;
          const maxLockYears = cfg ? (cfg.maxLockYears as number) : 4;
          const newYears = Math.min((record.lockYears as number) + (additionalYears as number), maxLockYears);
          const expiresAt = new Date(Date.now() + newYears * 365.25 * 86400000).toISOString();
          const veTokens = (record.amount as number) * (newYears / maxLockYears);
          return { newYears, expiresAt, veTokens };
        }, 'extendParams');

        let b2 = put(b, 've_lock', lock as string, {
          lockYears: 0,
          expiresAt: '',
          veTokens: 0,
        });

        return completeFrom(b2, 'extended', (bindings) => {
          const params = bindings.extendParams as Record<string, unknown>;
          return { lock, veTokens: params.veTokens, newLockYears: params.newYears };
        });
      },
      (b) => complete(b, 'not_found', { lock }),
    );

    return p as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    const { config, participant } = input;
    let p = createProgram();
    p = find(p, 've_lock', { config: config as string, locker: participant as string }, 'locks');
    p = get(p, 've_cfg', config as string, 'cfg');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const maxLockYears = cfg ? (cfg.maxLockYears as number) : 4;
      const maxLockMs = maxLockYears * 365.25 * 86400000;
      const now = Date.now();
      const locks = bindings.locks as Array<Record<string, unknown>>;

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

      return { veTokens: totalVeTokens, decayedWeight: totalDecayed };
    }, 'weightResult');

    return completeFrom(p, 'weight', (bindings) => {
      const result = bindings.weightResult as Record<string, unknown>;
      return { participant, veTokens: result.veTokens, decayedWeight: result.decayedWeight };
    }) as StorageProgram<Result>;
  },
};

export const voteEscrowHandler = autoInterpret(_voteEscrowHandler);
