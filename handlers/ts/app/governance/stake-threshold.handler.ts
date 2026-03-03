// StakeThreshold Sybil Resistance Provider
// Requires participants to stake a minimum amount; supports balance tracking and slashing.
import type { ConceptHandler } from '@clef/runtime';

export const stakeThresholdHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `stake-cfg-${Date.now()}`;
    await storage.put('stake_cfg', id, {
      id,
      minimumStake: input.minimumStake as number,
      token: input.token,
      lockPeriodDays: input.lockPeriodDays ?? 0,
    });

    await storage.put('plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'StakeThreshold',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async deposit(input, storage) {
    const { config, candidate, amount } = input;
    const key = `${config}:${candidate}`;
    const existing = await storage.get('stake_balance', key);
    const currentBalance = existing ? (existing.balance as number) : 0;
    const newBalance = currentBalance + (amount as number);

    await storage.put('stake_balance', key, {
      config,
      candidate,
      balance: newBalance,
      lastDepositAt: new Date().toISOString(),
    });

    return { variant: 'deposited', candidate, balance: newBalance };
  },

  async check(input, storage) {
    const { config, candidate } = input;
    const cfg = await storage.get('stake_cfg', config as string);
    if (!cfg) return { variant: 'not_found', config };

    const minimumStake = cfg.minimumStake as number;
    const key = `${config}:${candidate}`;
    const balanceRecord = await storage.get('stake_balance', key);
    const balance = balanceRecord ? (balanceRecord.balance as number) : 0;

    if (balance >= minimumStake) {
      return { variant: 'qualified', candidate, balance, minimumStake };
    }
    return { variant: 'insufficient', candidate, balance, minimumStake, shortfall: minimumStake - balance };
  },

  async slash(input, storage) {
    const { config, candidate, amount } = input;
    const key = `${config}:${candidate}`;
    const existing = await storage.get('stake_balance', key);
    if (!existing) return { variant: 'no_balance', candidate };

    const currentBalance = existing.balance as number;
    const slashAmount = Math.min(amount as number, currentBalance);
    const newBalance = currentBalance - slashAmount;

    await storage.put('stake_balance', key, { ...existing, balance: newBalance });
    return { variant: 'slashed', candidate, slashedAmount: slashAmount, remainingBalance: newBalance };
  },
};
