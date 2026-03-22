// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// TokenBalance Weight Source Provider
// Tracks token balances per participant at snapshot points for weighted governance.
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

export const tokenBalanceHandler: ConceptHandler = {
  async configure(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const id = `tb-cfg-${Date.now()}`;
    await storage.put('tb_cfg', id, {
      id,
      tokenContract: input.tokenContract,
      snapshotBlock: input.snapshotBlock ?? null,
    });
    await storage.put('plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'TokenBalance',
      instanceId: id,
    });
    return { variant: 'ok', config: id };
  },

  async setBalance(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, participant, balance } = input;
    const key = `${config}:${participant}`;
    await storage.put('tb_balance', key, {
      config, participant,
      balance: balance as number,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', participant, balance };
  },

  async takeSnapshot(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, blockRef } = input;
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

    return { variant: 'ok', snapshot: id, participantCount: balances.length };
  },

  async getBalance(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { config, participant, snapshot } = input;

    if (snapshot) {
      const snap = await storage.get('tb_snapshot', snapshot as string);
      if (!snap) return { variant: 'not_found', snapshot };
      const balances = snap.balances as Record<string, number>;
      const balance = balances[participant as string] ?? 0;
      return { variant: 'ok', participant, balance };
    }

    const key = `${config}:${participant}`;
    const record = await storage.get('tb_balance', key);
    const balance = record ? (record.balance as number) : 0;
    return { variant: 'ok', participant, balance };
  },
};
