// @migrated dsl-constructs 2026-03-18
// TokenBalance Weight Source Provider
// Tracks token balances per participant at snapshot points for weighted governance.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _tokenBalanceHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `tb-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'tb_cfg', id, {
      id,
      tokenContract: input.tokenContract,
      snapshotBlock: input.snapshotBlock ?? null,
    });
    p = put(p, 'plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'TokenBalance',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  setBalance(input: Record<string, unknown>) {
    const { config, participant, balance } = input;
    const key = `${config}:${participant}`;
    let p = createProgram();
    p = put(p, 'tb_balance', key, {
      config,
      participant,
      balance: balance as number,
      updatedAt: new Date().toISOString(),
    });
    return complete(p, 'updated', { participant, balance }) as StorageProgram<Result>;
  },

  takeSnapshot(input: Record<string, unknown>) {
    const { config, blockRef } = input;
    const id = `tb-snap-${Date.now()}`;
    let p = createProgram();
    p = find(p, 'tb_balance', { config: config as string }, 'balances');

    p = mapBindings(p, (bindings) => {
      const balances = bindings.balances as Array<Record<string, unknown>>;
      const snapshotData: Record<string, number> = {};
      for (const b of balances) {
        snapshotData[b.participant as string] = b.balance as number;
      }
      return { snapshotData, participantCount: balances.length };
    }, 'snapResult');

    p = put(p, 'tb_snapshot', id, {
      id,
      config,
      blockRef,
      balances: {},
      takenAt: new Date().toISOString(),
    });

    return completeFrom(p, 'snapped', (bindings) => {
      const result = bindings.snapResult as Record<string, unknown>;
      return { snapshot: id, participantCount: result.participantCount };
    }) as StorageProgram<Result>;
  },

  getBalance(input: Record<string, unknown>) {
    const { config, participant, snapshot } = input;

    if (snapshot) {
      let p = createProgram();
      p = get(p, 'tb_snapshot', snapshot as string, 'snap');

      p = branch(p, 'snap',
        (b) => {
          return completeFrom(b, 'balance', (bindings) => {
            const snap = bindings.snap as Record<string, unknown>;
            const balances = snap.balances as Record<string, number>;
            const balance = balances[participant as string] ?? 0;
            return { participant, balance };
          });
        },
        (b) => complete(b, 'not_found', { snapshot }),
      );

      return p as StorageProgram<Result>;
    }

    const key = `${config}:${participant}`;
    let p = createProgram();
    p = get(p, 'tb_balance', key, 'record');

    return completeFrom(p, 'balance', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      const balance = record ? (record.balance as number) : 0;
      return { participant, balance };
    }) as StorageProgram<Result>;
  },
};

export const tokenBalanceHandler = autoInterpret(_tokenBalanceHandler);
