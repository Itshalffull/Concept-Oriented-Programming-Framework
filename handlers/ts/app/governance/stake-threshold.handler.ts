// @migrated dsl-constructs 2026-03-18
// StakeThreshold Sybil Resistance Provider
// Requires participants to stake a minimum amount; supports balance tracking and slashing.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _stakeThresholdHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `stake-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'stake_cfg', id, {
      id,
      minimumStake: input.minimumStake as number,
      token: input.token,
      lockPeriodDays: input.lockPeriodDays ?? 0,
    });
    p = put(p, 'plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'StakeThreshold',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  deposit(input: Record<string, unknown>) {
    const { config, candidate, amount } = input;
    const key = `${config}:${candidate}`;
    let p = createProgram();
    p = get(p, 'stake_balance', key, 'existing');

    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const currentBalance = existing ? (existing.balance as number) : 0;
      return currentBalance + (amount as number);
    }, 'newBalance');

    p = put(p, 'stake_balance', key, {
      config,
      candidate,
      balance: 0,
      lastDepositAt: new Date().toISOString(),
    });

    return completeFrom(p, 'deposited', (bindings) => {
      return { candidate, balance: bindings.newBalance };
    }) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const { config, candidate } = input;
    let p = createProgram();
    p = get(p, 'stake_cfg', config as string, 'cfg');

    p = branch(p, 'cfg',
      (b) => {
        const key = `${config}:${candidate}`;
        b = get(b, 'stake_balance', key, 'balanceRecord');

        return completeFrom(b, 'qualified', (bindings) => {
          const cfg = bindings.cfg as Record<string, unknown>;
          const minimumStake = cfg.minimumStake as number;
          const balanceRecord = bindings.balanceRecord as Record<string, unknown> | null;
          const balance = balanceRecord ? (balanceRecord.balance as number) : 0;

          if (balance >= minimumStake) {
            return { variant: 'qualified', candidate, balance, minimumStake };
          }
          return { variant: 'insufficient', candidate, balance, minimumStake, shortfall: minimumStake - balance };
        });
      },
      (b) => complete(b, 'not_found', { config }),
    );

    return p as StorageProgram<Result>;
  },

  slash(input: Record<string, unknown>) {
    const { config, candidate, amount } = input;
    const key = `${config}:${candidate}`;
    let p = createProgram();
    p = get(p, 'stake_balance', key, 'existing');

    p = branch(p, 'existing',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const currentBalance = existing.balance as number;
          const slashAmount = Math.min(amount as number, currentBalance);
          const newBalance = currentBalance - slashAmount;
          return { slashedAmount: slashAmount, remainingBalance: newBalance };
        }, 'slashResult');

        let b2 = put(b, 'stake_balance', key, { balance: 0 });
        return completeFrom(b2, 'slashed', (bindings) => {
          const result = bindings.slashResult as Record<string, unknown>;
          return { candidate, slashedAmount: result.slashedAmount, remainingBalance: result.remainingBalance };
        });
      },
      (b) => complete(b, 'no_balance', { candidate }),
    );

    return p as StorageProgram<Result>;
  },
};

export const stakeThresholdHandler = autoInterpret(_stakeThresholdHandler);
