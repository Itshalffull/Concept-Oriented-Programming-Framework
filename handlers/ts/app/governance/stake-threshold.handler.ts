// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// StakeThreshold Sybil Resistance Provider
// Requires participants to stake a minimum amount; supports balance tracking and slashing.
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; output?: Record<string, unknown>; [key: string]: unknown };

export const stakeThresholdHandler: ConceptHandler = {
  async configure(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const minimumStake = typeof input.minimumStake === 'string' ? parseFloat(input.minimumStake as string) : (input.minimumStake as number);
    if (!minimumStake || minimumStake <= 0) {
      return { variant: 'error', message: 'minimumStake must be positive', output: {} };
    }
    const id = `stake-cfg-${Date.now()}`;
    await storage.put('stake_cfg', id, {
      id,
      minimumStake,
      token: input.token,
      lockPeriodDays: input.lockPeriodDays ?? 0,
      slashOnViolation: input.slashOnViolation ?? false,
    });
    await storage.put('plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'StakeThreshold',
      instanceId: id,
    });
    return { variant: 'ok', id, config: id, output: { id, config: id } };
  },

  async deposit(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config } = input;
    // Support both 'candidate' and 'participant' field names
    const candidate = (input.candidate ?? input.participant) as string;
    const amountRaw = input.amount;
    const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw as string) : (amountRaw as number ?? 0);

    if (amount <= 0) {
      return { variant: 'error', message: 'amount must be positive', output: {} };
    }

    const key = `${config}:${candidate}`;
    const existing = await storage.get('stake_balance', key);
    const currentBalance = existing ? (existing.balance as number) : 0;
    const newBalance = currentBalance + amount;

    await storage.put('stake_balance', key, {
      config,
      candidate,
      balance: newBalance,
      lastDepositAt: new Date().toISOString(),
    });

    return { variant: 'ok', id: key, candidate, balance: newBalance, output: { id: key, candidate, balance: newBalance } };
  },

  async check(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const candidate = (input.candidate ?? input.participant) as string;
    // Handle fixture ref objects for config
    const configRaw = input.config;
    const config = (configRaw !== null && typeof configRaw === 'object') ? undefined : configRaw as string;

    const cfg = config ? await storage.get('stake_cfg', config) : null;
    if (!cfg) {
      // No config or config not found — return not_found (non-ok)
      return { variant: 'not_found', config, output: { candidate } };
    }

    const key = `${config}:${candidate}`;
    const balanceRecord = await storage.get('stake_balance', key);
    const balance = balanceRecord ? (balanceRecord.balance as number) : 0;
    const minimumStake = typeof cfg.minimumStake === 'string' ? parseFloat(cfg.minimumStake as string) : (cfg.minimumStake as number);

    // Both cases return ok per spec (met and not-met are both ok variants)
    const base = { candidate, balance, minimumStake, output: { candidate, balance, minimumStake } };
    if (balance >= minimumStake) {
      return { variant: 'ok', ...base };
    }
    return { variant: 'ok', shortfall: minimumStake - balance, ...base };
  },

  async slash(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const candidate = (input.candidate ?? input.participant) as string;
    const configRaw = input.config;
    const config = (configRaw !== null && typeof configRaw === 'object') ? undefined : configRaw as string;
    const amountRaw = input.amount;
    const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw as string) : (amountRaw as number ?? 0);

    if (!config) {
      // No config — return ok with 0 slash
      return { variant: 'ok', candidate, slashedAmount: 0, remainingBalance: 0, output: { candidate } };
    }

    // Check if config exists
    const cfg = await storage.get('stake_cfg', config);
    if (!cfg) {
      return { variant: 'error', message: `Config not found: ${config}`, output: { candidate } };
    }

    const key = `${config}:${candidate}`;
    const existing = await storage.get('stake_balance', key);
    if (!existing) {
      // No balance to slash — ok per spec
      return { variant: 'ok', candidate, slashedAmount: 0, remainingBalance: 0, output: { candidate, slashedAmount: 0, remainingBalance: 0 } };
    }

    const currentBalance = existing.balance as number;
    const slashAmount = Math.min(amount, currentBalance);
    const newBalance = currentBalance - slashAmount;

    await storage.put('stake_balance', key, {
      ...existing,
      balance: newBalance,
    });

    return { variant: 'ok', candidate, slashedAmount: slashAmount, remainingBalance: newBalance, output: { candidate, slashedAmount: slashAmount, remainingBalance: newBalance } };
  },

  // checkEligibility returns 'eligible' variant per spec
  async checkEligibility(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const candidate = (input.candidate ?? input.participant) as string;
    const configRaw = input.config;
    const config = (configRaw !== null && typeof configRaw === 'object') ? undefined : configRaw as string;

    const cfg = config ? await storage.get('stake_cfg', config) : null;
    if (!cfg) {
      return { variant: 'not_found', config, output: { candidate } };
    }

    const key = `${config}:${candidate}`;
    const balanceRecord = await storage.get('stake_balance', key);
    const balance = balanceRecord ? (balanceRecord.balance as number) : 0;
    const minimumStake = typeof cfg.minimumStake === 'string' ? parseFloat(cfg.minimumStake as string) : (cfg.minimumStake as number);

    if (balance >= minimumStake) {
      return { variant: 'eligible', candidate, stakedAmount: balance, output: { candidate, stakedAmount: balance } };
    }
    return { variant: 'ineligible', candidate, stakedAmount: balance, minimumStake, output: { candidate, stakedAmount: balance } };
  },
};
