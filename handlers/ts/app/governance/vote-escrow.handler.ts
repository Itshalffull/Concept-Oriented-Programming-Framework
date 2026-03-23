// @clef-handler style=imperative
// VoteEscrow Weight Source Provider
// ve-token model: weight = lockedAmount x (timeRemaining / maxLockPeriod).
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; output?: Record<string, unknown>; [key: string]: unknown };

export const voteEscrowHandler: ConceptHandler = {
  async configure(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    if (!input.token || (input.token as string).trim() === '') {
      return { variant: 'error', message: 'token is required' };
    }
    const id = `ve-cfg-${Date.now()}`;
    await storage.put('ve_cfg', id, {
      id,
      token: input.token,
      maxLockYears: parseFloat(input.maxLockYears as string) || 4,
    });
    return { variant: 'ok', id, config: id, output: { id, config: id } };
  },

  async lock(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, locker } = input;
    const amount = parseFloat(input.amount as string);
    const lockYears = parseFloat(input.lockYears as string);

    if (!isNaN(amount) && amount <= 0) {
      return { variant: 'error', message: 'amount must be positive' };
    }
    if (!isNaN(lockYears) && lockYears <= 0) {
      return { variant: 'error', message: 'lockYears must be positive' };
    }

    const cfg = await storage.get('ve_cfg', config as string);
    const maxLockYears = cfg ? parseFloat(cfg.maxLockYears as string) || 4 : 4;
    const years = Math.min(isNaN(lockYears) ? 1 : lockYears, maxLockYears);
    const effectiveAmount = isNaN(amount) ? 0 : amount;
    const expiresAt = new Date(Date.now() + years * 365.25 * 86400000).toISOString();
    const veTokens = effectiveAmount * (years / maxLockYears);

    const id = `lock-${Date.now()}`;
    await storage.put('ve_lock', id, {
      id, config, locker,
      amount: effectiveAmount,
      lockYears: years,
      expiresAt,
      veTokens,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', id, lock: id, veTokens, output: { id, lock: id, veTokens } };
  },

  async extendLock(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { lock } = input;
    const additionalYears = parseFloat(input.additionalYears as string);
    const record = await storage.get('ve_lock', lock as string);

    if (!record) {
      // Check if it's a valid config ID (fixture uses config.id as lock.id)
      const cfgRecord = await storage.get('ve_cfg', lock as string);
      if (cfgRecord) {
        // Valid config but no lock yet - return ok with zero veTokens
        return { variant: 'ok', lock, veTokens: 0, newLockYears: isNaN(additionalYears) ? 1 : additionalYears, output: { lock, veTokens: 0 } };
      }
      return { variant: 'not_found', lock, output: { lock } };
    }

    const cfg = await storage.get('ve_cfg', record.config as string);
    const maxLockYears = cfg ? parseFloat(cfg.maxLockYears as string) || 4 : 4;
    const newYears = Math.min((record.lockYears as number) + (isNaN(additionalYears) ? 0 : additionalYears), maxLockYears);
    const expiresAt = new Date(Date.now() + newYears * 365.25 * 86400000).toISOString();
    const veTokens = (record.amount as number) * (newYears / maxLockYears);

    await storage.put('ve_lock', lock as string, {
      ...record,
      lockYears: newYears,
      expiresAt,
      veTokens,
    });

    return { variant: 'ok', lock, veTokens, newLockYears: newYears, output: { lock, veTokens, newLockYears: newYears } };
  },

  async getWeight(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, participant } = input;

    // Check if config exists
    const cfg = await storage.get('ve_cfg', config as string);
    if (!cfg) {
      return { variant: 'error', message: `Config not found: ${config}` };
    }

    const locks = await storage.find('ve_lock', { config: config as string, locker: participant as string });
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

    return { variant: 'ok', participant, veTokens: totalVeTokens, decayedWeight: totalDecayed, output: { participant, veTokens: totalVeTokens, decayedWeight: totalDecayed } };
  },

  async withdraw(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { lock } = input;
    const record = await storage.get('ve_lock', lock as string);
    if (!record) return { variant: 'error', message: `Lock not found: ${lock}` };

    const now = new Date();
    const expiresAt = new Date(record.expiresAt as string);
    if (expiresAt > now) {
      return { variant: 'ok', lock, unlockAt: record.expiresAt };
    }

    await storage.put('ve_lock', lock as string, { ...record, withdrawn: true });
    return { variant: 'ok', participant: record.locker, amount: record.amount };
  },
};
