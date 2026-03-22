// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// StakeWeight Source Provider
// Tracks staked amounts with cooldown periods; sums active stakes for governance weight.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _stakeWeightHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `sw-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'sw_cfg', id, {
      id,
      token: input.token,
      cooldownDays: input.cooldownDays ?? 0,
    });
    p = put(p, 'plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'StakeWeight',
      instanceId: id,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  stake(input: Record<string, unknown>) {
    const { config, staker, amount } = input;
    let p = createProgram();
    p = get(p, 'sw_cfg', config as string, 'cfg');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const cooldownDays = cfg ? (cfg.cooldownDays as number) : 0;
      return new Date(Date.now() + cooldownDays * 86400000).toISOString();
    }, 'lockedUntil');

    const id = `stake-${Date.now()}`;
    p = put(p, 'sw_stake', id, {
      id,
      config,
      staker,
      amount: amount as number,
      lockedUntil: '',
      status: 'active',
      stakedAt: new Date().toISOString(),
    });

    return completeFrom(p, 'staked', (bindings) => {
      return { stake: id, lockedUntil: bindings.lockedUntil };
    }) as StorageProgram<Result>;
  },

  unstake(input: Record<string, unknown>) {
    const { stake } = input;
    let p = createProgram();
    p = get(p, 'sw_stake', stake as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'unstaked', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const now = new Date();
          if (now < new Date(record.lockedUntil as string)) {
            return { variant: 'ok', stake, lockedUntil: record.lockedUntil };
          }
          return { variant: 'ok', stake, amount: record.amount };
        });
      },
      (b) => complete(b, 'not_found', { stake }),
    );

    return p as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    const { config, participant } = input;
    let p = createProgram();
    p = find(p, 'sw_stake', { config: config as string, staker: participant as string }, 'allStakes');

    p = mapBindings(p, (bindings) => {
      const allStakes = bindings.allStakes as Array<Record<string, unknown>>;
      let totalStaked = 0;
      for (const s of allStakes) {
        if (s.status === 'active') {
          totalStaked += s.amount as number;
        }
      }
      return totalStaked;
    }, 'totalStaked');

    return completeFrom(p, 'weight', (bindings) => {
      return { participant, stakedAmount: bindings.totalStaked };
    }) as StorageProgram<Result>;
  },
};

export const stakeWeightHandler = autoInterpret(_stakeWeightHandler);
