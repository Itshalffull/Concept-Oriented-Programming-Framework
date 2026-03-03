// RageQuit Concept Handler
// Proportional exit for minority dissent (MolochDAO pattern).
import type { ConceptHandler } from '@clef/runtime';

export const rageQuitHandler: ConceptHandler = {
  async initiate(input, storage) {
    const id = `rq-${Date.now()}`;
    await storage.put('ragequit', id, {
      id, member: input.member, shares: input.shares, loot: input.loot,
      status: 'Initiated', initiatedAt: new Date().toISOString(),
    });
    return { variant: 'initiated', exit: id };
  },

  async calculateClaim(input, storage) {
    const { exit } = input;
    const record = await storage.get('ragequit', exit as string);
    if (!record) return { variant: 'not_found', exit };
    // Stub: real impl calculates proportional treasury share
    const claims: Record<string, number> = {};
    await storage.put('ragequit', exit as string, { ...record, claims, status: 'Calculated' });
    return { variant: 'calculated', exit, claims: JSON.stringify(claims) };
  },

  async claim(input, storage) {
    const { exit } = input;
    const record = await storage.get('ragequit', exit as string);
    if (!record) return { variant: 'not_found', exit };
    if (record.status !== 'Calculated') return { variant: 'not_calculated', exit };
    await storage.put('ragequit', exit as string, { ...record, status: 'Claimed', claimedAt: new Date().toISOString() });
    return { variant: 'claimed', exit };
  },
};
