// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// StakeThreshold Sybil Resistance Provider
// Requires participants to stake a minimum amount; supports balance tracking and slashing.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _stakeThresholdHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const minimumStake = typeof input.minimumStake === 'string'
      ? parseFloat(input.minimumStake as string)
      : (input.minimumStake as number);

    if (!minimumStake || minimumStake <= 0) {
      return complete(createProgram(), 'error', { message: 'minimumStake must be positive' }) as StorageProgram<Result>;
    }

    const id = `stake-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'stake_cfg', id, {
      id,
      minimumStake,
      token: input.token as string,
      lockPeriodDays: input.lockPeriodDays ?? 0,
      slashOnViolation: input.slashOnViolation ?? false,
    });
    p = put(p, 'plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'StakeThreshold',
      instanceId: id,
    });
    return complete(p, 'ok', { id, config: id, output: { id, config: id } }) as StorageProgram<Result>;
  },

  deposit(input: Record<string, unknown>) {
    const config = input.config as string;
    const candidate = (input.candidate ?? input.participant) as string;
    const amountRaw = input.amount;
    const amount = typeof amountRaw === 'string'
      ? parseFloat(amountRaw as string)
      : (amountRaw as number ?? 0);

    if (amount <= 0) {
      return complete(createProgram(), 'error', { message: 'amount must be positive' }) as StorageProgram<Result>;
    }

    const key = `${config}:${candidate}`;
    let p = createProgram();
    p = get(p, 'stake_balance', key, '_existing');
    p = mapBindings(p, (b) => {
      const existing = b._existing as Record<string, unknown> | null;
      const currentBalance = existing ? (existing.balance as number) : 0;
      return currentBalance + amount;
    }, '_newBalance');
    p = putFrom(p, 'stake_balance', key, (b) => ({
      config,
      candidate,
      balance: b._newBalance as number,
      lastDepositAt: new Date().toISOString(),
    }));
    return completeFrom(p, 'ok', (b) => ({
      id: key,
      candidate,
      balance: b._newBalance as number,
    })) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const candidate = (input.candidate ?? input.participant) as string;
    const configRaw = input.config;
    const config = (configRaw !== null && typeof configRaw === 'object')
      ? undefined
      : configRaw as string;

    if (!config) {
      return complete(createProgram(), 'not_found', { config, candidate }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'stake_cfg', config, '_cfg');

    return branch(p,
      (b) => !b._cfg,
      (b) => complete(b, 'not_found', { config, candidate }),
      (b) => {
        const key = `${config}:${candidate}`;
        let b2 = get(b, 'stake_balance', key, '_balanceRecord');
        return completeFrom(b2, 'ok', (bindings) => {
          const cfg = bindings._cfg as Record<string, unknown>;
          const balanceRecord = bindings._balanceRecord as Record<string, unknown> | null;
          const balance = balanceRecord ? (balanceRecord.balance as number) : 0;
          const minimumStake = typeof cfg.minimumStake === 'string'
            ? parseFloat(cfg.minimumStake as string)
            : (cfg.minimumStake as number);
          const base = { candidate, balance, minimumStake };
          if (balance >= minimumStake) return base;
          return { ...base, shortfall: minimumStake - balance };
        });
      },
    ) as StorageProgram<Result>;
  },

  slash(input: Record<string, unknown>) {
    const candidate = (input.candidate ?? input.participant) as string;
    const configRaw = input.config;
    const config = (configRaw !== null && typeof configRaw === 'object')
      ? undefined
      : configRaw as string;
    const amountRaw = input.amount;
    const amount = typeof amountRaw === 'string'
      ? parseFloat(amountRaw as string)
      : (amountRaw as number ?? 0);

    if (!config) {
      return complete(createProgram(), 'ok', { candidate, slashedAmount: 0, remainingBalance: 0 }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'stake_cfg', config, '_cfg');

    return branch(p,
      (b) => !b._cfg,
      (b) => complete(b, 'error', { message: `Config not found: ${config}`, candidate }),
      (b) => {
        const key = `${config}:${candidate}`;
        let b2 = get(b, 'stake_balance', key, '_existing');
        return branch(b2,
          (bindings) => !bindings._existing,
          (bindings) => complete(bindings, 'ok', { candidate, slashedAmount: 0, remainingBalance: 0 }),
          (bindings) => {
            let b3 = mapBindings(bindings, (bb) => {
              const existing = bb._existing as Record<string, unknown>;
              const currentBalance = existing.balance as number;
              const slashAmount = Math.min(amount, currentBalance);
              return { slashAmount, newBalance: currentBalance - slashAmount };
            }, '_slash');
            let b4 = putFrom(b3, 'stake_balance', key, (bb) => {
              const existing = bb._existing as Record<string, unknown>;
              const slash = bb._slash as { slashAmount: number; newBalance: number };
              return { ...existing, balance: slash.newBalance };
            });
            return completeFrom(b4, 'ok', (bb) => {
              const slash = bb._slash as { slashAmount: number; newBalance: number };
              return { candidate, slashedAmount: slash.slashAmount, remainingBalance: slash.newBalance };
            });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  checkEligibility(input: Record<string, unknown>) {
    const candidate = (input.candidate ?? input.participant) as string;
    const configRaw = input.config;
    const config = (configRaw !== null && typeof configRaw === 'object')
      ? undefined
      : configRaw as string;

    if (!config) {
      return complete(createProgram(), 'not_found', { config, candidate }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'stake_cfg', config, '_cfg');

    return branch(p,
      (b) => !b._cfg,
      (b) => complete(b, 'not_found', { config, candidate }),
      (b) => {
        const key = `${config}:${candidate}`;
        let b2 = get(b, 'stake_balance', key, '_balanceRecord');
        b2 = mapBindings(b2, (bindings) => {
          const balanceRecord = bindings._balanceRecord as Record<string, unknown> | null;
          return balanceRecord ? (balanceRecord.balance as number) : 0;
        }, '_balance');
        b2 = mapBindings(b2, (bindings) => {
          const cfg = bindings._cfg as Record<string, unknown>;
          return typeof cfg.minimumStake === 'string'
            ? parseFloat(cfg.minimumStake as string)
            : (cfg.minimumStake as number);
        }, '_minimumStake');
        return branch(b2,
          (bindings) => (bindings._balance as number) >= (bindings._minimumStake as number),
          (bindings) => completeFrom(bindings, 'eligible', (bb) => ({
            candidate,
            stakedAmount: bb._balance as number,
          })),
          (bindings) => completeFrom(bindings, 'ineligible', (bb) => ({
            candidate,
            stakedAmount: bb._balance as number,
            minimumStake: bb._minimumStake as number,
          })),
        );
      },
    ) as StorageProgram<Result>;
  },
};

export const stakeThresholdHandler = autoInterpret(_stakeThresholdHandler);
