// @clef-handler style=imperative
// TokenBalance Concept Handler
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; output?: Record<string, unknown>; [key: string]: unknown };

export const tokenBalanceHandler: ConceptHandler = {
  async configure(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    if (!input.tokenContract || (input.tokenContract as string).trim() === '') {
      return { variant: 'error', message: 'tokenContract is required' };
    }
    const id = `tb-cfg-${Date.now()}`;
    await storage.put('tb_cfg', id, {
      id,
      tokenContract: input.tokenContract,
      snapshotBlock: input.snapshotBlock ?? null,
    });
    return { variant: 'ok', id, config: id, output: { id, config: id } };
  },

  async setBalance(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, participant, balance } = input;
    if (balance !== undefined && (balance as number) <= 0) {
      return { variant: 'error', message: 'balance must be positive' };
    }
    const key = `${config}:${participant}`;
    await storage.put('tb_balance', key, {
      config, participant,
      balance: balance as number,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', participant, balance, output: { participant, balance } };
  },

  async takeSnapshot(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, blockRef } = input;
    if (!blockRef || (blockRef as string).trim() === '') {
      return { variant: 'error', message: 'blockRef is required' };
    }
    const id = `tb-snap-${Date.now()}`;
    const balances = await storage.find('tb_balance', { config: config as string });
    const snapshotData: Record<string, number> = {};
    for (const b of balances) {
      snapshotData[b.participant as string] = b.balance as number;
    }
    await storage.put('tb_snapshot', id, {
      id, config, blockRef,
      balances: snapshotData,
      takenAt: new Date().toISOString(),
    });
    return { variant: 'ok', snapshot: id, participantCount: balances.length, output: { snapshot: id, participantCount: balances.length } };
  },

  async getBalance(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, participant, snapshot } = input;
    if (snapshot) {
      const snap = await storage.get('tb_snapshot', snapshot as string);
      if (!snap) {
        // Fall back to direct balance lookup
        const key2 = `${config}:${participant}`;
        const rec = await storage.get('tb_balance', key2);
        const bal = rec ? (rec.balance as number) : 0;
        return { variant: 'ok', participant, balance: bal, output: { participant, balance: bal } };
      }
      const balances = snap.balances as Record<string, number>;
      const balance = balances[participant as string] ?? 0;
      return { variant: 'ok', participant, balance, output: { participant, balance } };
    }
    const key = `${config}:${participant}`;
    const record = await storage.get('tb_balance', key);
    const balance = record ? (record.balance as number) : 0;
    return { variant: 'ok', participant, balance, output: { participant, balance } };
  },
};
