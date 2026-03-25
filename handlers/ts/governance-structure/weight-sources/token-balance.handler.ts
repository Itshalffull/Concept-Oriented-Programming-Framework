// @clef-handler style=functional
// TokenBalance Source Provider
// Derive governance weight from a participant's balance of a specific
// token at a point in time, the standard model for token-weighted governance.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'TokenBalance' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    if (!input.tokenContract || (typeof input.tokenContract === 'string' && (input.tokenContract as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tokenContract is required' }) as StorageProgram<Result>;
    }
    const id = `tb-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'tb_cfg', id, {
      id,
      tokenContract: input.tokenContract,
      snapshotBlock: input.snapshotBlock ?? null,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  setBalance(input: Record<string, unknown>) {
    const { config, participant, balance } = input;
    if (balance !== undefined && (balance as number) <= 0) {
      return complete(createProgram(), 'error', { message: 'balance must be positive' }) as StorageProgram<Result>;
    }
    const key = `${config}:${participant}`;
    let p = createProgram();
    p = put(p, 'tb_balance', key, {
      config, participant,
      balance: balance as number,
      updatedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { participant, balance }) as StorageProgram<Result>;
  },

  takeSnapshot(input: Record<string, unknown>) {
    const { config, blockRef } = input;
    if (!blockRef || (typeof blockRef === 'string' && (blockRef as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'blockRef is required' }) as StorageProgram<Result>;
    }
    const id = `tb-snap-${Date.now()}`;
    let p = createProgram();
    p = find(p, 'tb_balance', { config: config as string }, 'balances');
    p = mapBindings(p, (b) => {
      const bals = b.balances as Array<Record<string, unknown>>;
      const snapshot: Record<string, number> = {};
      for (const rec of bals) {
        snapshot[rec.participant as string] = rec.balance as number;
      }
      return snapshot;
    }, 'snapshotData');
    p = putFrom(p, 'tb_snapshot', id, (b) => ({
      id, config, blockRef,
      balances: b.snapshotData as Record<string, number>,
      takenAt: new Date().toISOString(),
    }));
    return completeFrom(p, 'ok', (b) => ({
      snapshot: id,
      participantCount: Object.keys(b.snapshotData as Record<string, unknown>).length,
    })) as StorageProgram<Result>;
  },

  getBalance(input: Record<string, unknown>) {
    const { config, participant, snapshot } = input;

    if (snapshot) {
      let p = createProgram();
      p = get(p, 'tb_snapshot', snapshot as string, 'snap');
      return branch(p,
        (b) => b.snap != null,
        (() => {
          let q = createProgram();
          q = get(q, 'tb_snapshot', snapshot as string, 'snap');
          return completeFrom(q, 'ok', (b) => {
            const snapRec = b.snap as Record<string, unknown>;
            const bals = snapRec.balances as Record<string, number>;
            const bal = bals[participant as string] ?? 0;
            return { participant, balance: bal };
          });
        })(),
        (() => {
          const key2 = `${config}:${participant}`;
          let q = createProgram();
          q = get(q, 'tb_balance', key2, 'rec');
          return completeFrom(q, 'ok', (b) => {
            const rec = b.rec as Record<string, unknown> | null;
            return { participant, balance: rec ? (rec.balance as number) : 0 };
          });
        })(),
      ) as StorageProgram<Result>;
    }

    const key = `${config}:${participant}`;
    let p = createProgram();
    p = get(p, 'tb_balance', key, 'record');
    return completeFrom(p, 'ok', (b) => {
      const rec = b.record as Record<string, unknown> | null;
      return { participant, balance: rec ? (rec.balance as number) : 0 };
    }) as StorageProgram<Result>;
  },
};

export const tokenBalanceHandler = autoInterpret(_handler);
