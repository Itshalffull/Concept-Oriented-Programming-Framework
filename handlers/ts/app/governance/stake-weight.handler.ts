// StakeWeight Source Provider
// Tracks staked amounts with cooldown periods; sums active stakes for governance weight.
import type { ConceptHandler } from '@clef/runtime';

export const stakeWeightHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `sw-cfg-${Date.now()}`;
    await storage.put('sw_cfg', id, {
      id,
      token: input.token,
      cooldownDays: input.cooldownDays ?? 0,
    });

    await storage.put('plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'StakeWeight',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async stake(input, storage) {
    const { config, staker, amount } = input;
    const cfg = await storage.get('sw_cfg', config as string);
    const cooldownDays = cfg ? (cfg.cooldownDays as number) : 0;
    const id = `stake-${Date.now()}`;
    const lockedUntil = new Date(Date.now() + cooldownDays * 86400000).toISOString();

    await storage.put('sw_stake', id, {
      id,
      config,
      staker,
      amount: amount as number,
      lockedUntil,
      status: 'active',
      stakedAt: new Date().toISOString(),
    });

    return { variant: 'staked', stake: id, lockedUntil };
  },

  async unstake(input, storage) {
    const { stake } = input;
    const record = await storage.get('sw_stake', stake as string);
    if (!record) return { variant: 'not_found', stake };

    const now = new Date();
    if (now < new Date(record.lockedUntil as string)) {
      return { variant: 'locked', stake, lockedUntil: record.lockedUntil };
    }

    await storage.put('sw_stake', stake as string, { ...record, status: 'unstaked' });
    return { variant: 'unstaked', stake, amount: record.amount };
  },

  async getWeight(input, storage) {
    const { config, participant } = input;
    const allStakes = await storage.find('sw_stake', { config: config as string, staker: participant as string });
    let totalStaked = 0;
    for (const s of allStakes) {
      if (s.status === 'active') {
        totalStaked += s.amount as number;
      }
    }
    return { variant: 'weight', participant, stakedAmount: totalStaked };
  },
};
