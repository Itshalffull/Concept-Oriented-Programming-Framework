// Conviction Concept Handler
// Continuous staking with exponential charge — @gate concept.
import type { ConceptHandler } from '@clef/runtime';

export const convictionHandler: ConceptHandler = {
  async registerProposal(input, storage) {
    const id = `conviction-${Date.now()}`;
    await storage.put('conviction', id, {
      id, proposalRef: input.proposalRef, threshold: input.threshold,
      halfLifeDays: input.halfLifeDays, totalStaked: 0, stakes: [], status: 'Active',
    });
    return { variant: 'registered', proposal: id };
  },

  async stake(input, storage) {
    const { proposal, staker, amount } = input;
    const record = await storage.get('conviction', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    const stakes = record.stakes as Array<{ staker: unknown; amount: unknown; stakedAt: string }>;
    stakes.push({ staker, amount, stakedAt: new Date().toISOString() });
    const totalStaked = (record.totalStaked as number) + (amount as number);
    await storage.put('conviction', proposal as string, { ...record, stakes, totalStaked });
    return { variant: 'staked', proposal, newTotal: totalStaked };
  },

  async unstake(input, storage) {
    const { proposal, staker, amount } = input;
    const record = await storage.get('conviction', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    const totalStaked = Math.max(0, (record.totalStaked as number) - (amount as number));
    await storage.put('conviction', proposal as string, { ...record, totalStaked });
    return { variant: 'unstaked', proposal, newTotal: totalStaked };
  },

  async updateConviction(input, storage) {
    const { proposal } = input;
    const record = await storage.get('conviction', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    const conviction = record.totalStaked as number;
    const threshold = record.threshold as number;
    if (conviction >= threshold) {
      await storage.put('conviction', proposal as string, { ...record, status: 'Triggered' });
      return { variant: 'triggered', proposal, conviction };
    }
    return { variant: 'updated', proposal, conviction };
  },
};
