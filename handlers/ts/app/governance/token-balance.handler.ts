// @clef-handler style=functional
// TokenBalance Concept Handler
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _tokenBalanceHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    if (!input.tokenContract || (input.tokenContract as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'tokenContract is required' }) as StorageProgram<Result>;
    }
    const id = `tb-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'tb_cfg', id, {
      id,
      tokenContract: input.tokenContract as string,
      snapshotBlock: input.snapshotBlock ?? null,
    });
    return complete(p, 'ok', { id, config: id, output: { id, config: id } }) as StorageProgram<Result>;
  },

  setBalance(input: Record<string, unknown>) {
    const config = input.config as string;
    const participant = input.participant as string;
    const balance = input.balance as number;

    if (balance !== undefined && balance <= 0) {
      return complete(createProgram(), 'error', { message: 'balance must be positive' }) as StorageProgram<Result>;
    }

    const key = `${config}:${participant}`;
    let p = createProgram();
    p = put(p, 'tb_balance', key, {
      config,
      participant,
      balance,
      updatedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { participant, balance }) as StorageProgram<Result>;
  },

  takeSnapshot(input: Record<string, unknown>) {
    const config = input.config as string;
    const blockRef = input.blockRef as string;

    if (!blockRef || blockRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'blockRef is required' }) as StorageProgram<Result>;
    }

    const id = `tb-snap-${Date.now()}`;
    let p = createProgram();
    p = find(p, 'tb_balance', { config }, '_balances');
    p = mapBindings(p, (b) => {
      const balances = b._balances as Array<Record<string, unknown>>;
      const snapshotData: Record<string, number> = {};
      for (const bal of balances) {
        snapshotData[bal.participant as string] = bal.balance as number;
      }
      return snapshotData;
    }, '_snapshotData');
    p = putFrom(p, 'tb_snapshot', id, (b) => ({
      id,
      config,
      blockRef,
      balances: b._snapshotData as Record<string, number>,
      takenAt: new Date().toISOString(),
    }));
    return completeFrom(p, 'ok', (b) => ({
      snapshot: id,
      participantCount: (b._balances as unknown[]).length,
    })) as StorageProgram<Result>;
  },

  getBalance(input: Record<string, unknown>) {
    const config = input.config as string;
    const participant = input.participant as string;
    const snapshot = input.snapshot as string | undefined;

    if (snapshot) {
      let p = createProgram();
      p = get(p, 'tb_snapshot', snapshot, '_snap');

      return branch(p,
        (b) => !!b._snap,
        (b) => completeFrom(b, 'ok', (bindings) => {
          const snap = bindings._snap as Record<string, unknown>;
          const balances = snap.balances as Record<string, number>;
          const balance = balances[participant] ?? 0;
          return { participant, balance };
        }),
        (b) => {
          const key = `${config}:${participant}`;
          let b2 = get(b, 'tb_balance', key, '_record');
          return completeFrom(b2, 'ok', (bindings) => {
            const record = bindings._record as Record<string, unknown> | null;
            const balance = record ? (record.balance as number) : 0;
            return { participant, balance };
          });
        },
      ) as StorageProgram<Result>;
    }

    const key = `${config}:${participant}`;
    let p = createProgram();
    p = get(p, 'tb_balance', key, '_record');
    return completeFrom(p, 'ok', (b) => {
      const record = b._record as Record<string, unknown> | null;
      const balance = record ? (record.balance as number) : 0;
      return { participant, balance };
    }) as StorageProgram<Result>;
  },
};

export const tokenBalanceHandler = autoInterpret(_tokenBalanceHandler);
