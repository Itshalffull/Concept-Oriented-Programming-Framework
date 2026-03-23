// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// VoteEscrow Weight Source Provider
// ve-token model: weight = lockedAmount x (timeRemaining / maxLockPeriod).
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

export const voteEscrowHandler: ConceptHandler = {
  async configure(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const id = `ve-cfg-${Date.now()}`;
    await storage.put('ve_cfg', id, {
      id,
      token: input.token,
      maxLockYears: input.maxLockYears ?? 4,
    });
    await storage.put('plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'VoteEscrow',
      instanceId: id,
    });
    return { variant: 'ok', id, config: id };
  },

  async lock(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, locker, amount, lockYears } = input;
    const cfg = await storage.get('ve_cfg', config as string);
    const maxLockYears = cfg ? (cfg.maxLockYears as number) : 4;
    const years = Math.min(lockYears as number, maxLockYears);
    const expiresAt = new Date(Date.now() + years * 365.25 * 86400000).toISOString();
    const veTokens = (amount as number) * (years / maxLockYears);

    const id = `lock-${Date.now()}`;
    await storage.put('ve_lock', id, {
      id, config, locker,
      amount: amount as number,
      lockYears: years,
      expiresAt,
      veTokens,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', id, lock: id, veTokens };
  },

  async extendLock(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { lock, additionalYears } = input;
    const record = await storage.get('ve_lock', lock as string);
    if (!record) return { variant: 'not_found', lock };

    const cfg = await storage.get('ve_cfg', record.config as string);
    const maxLockYears = cfg ? (cfg.maxLockYears as number) : 4;
    const newYears = Math.min((record.lockYears as number) + (additionalYears as number), maxLockYears);
    const expiresAt = new Date(Date.now() + newYears * 365.25 * 86400000).toISOString();
    const veTokens = (record.amount as number) * (newYears / maxLockYears);

    await storage.put('ve_lock', lock as string, {
      ...record,
      lockYears: newYears,
      expiresAt,
      veTokens,
    });

    return { variant: 'ok', lock, veTokens, newLockYears: newYears };
  },

  async getWeight(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, participant } = input;
    const locks = await storage.find('ve_lock', { config: config as string, locker: participant as string });
    const cfg = await storage.get('ve_cfg', config as string);
    const maxLockYears = cfg ? (cfg.maxLockYears as number) : 4;
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

    return { variant: 'ok', participant, veTokens: totalVeTokens, decayedWeight: totalDecayed };
  },
};
