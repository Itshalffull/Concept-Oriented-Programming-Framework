// Proposal Concept Handler
// Formal request for collective decision with Draft→Active→Passed/Failed lifecycle.
import type { ConceptHandler } from '@clef/runtime';

export const proposalHandler: ConceptHandler = {
  async create(input, storage) {
    const id = `proposal-${Date.now()}`;
    await storage.put('proposal', id, {
      id, proposer: input.proposer, title: input.title, description: input.description,
      actions: input.actions, status: 'Draft', createdAt: new Date().toISOString(),
    });
    return { variant: 'created', proposal: id };
  },

  async sponsor(input, storage) {
    const { proposal, sponsor } = input;
    const record = await storage.get('proposal', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    await storage.put('proposal', proposal as string, { ...record, status: 'Sponsored', sponsor });
    return { variant: 'sponsored', proposal };
  },

  async activate(input, storage) {
    const { proposal } = input;
    const record = await storage.get('proposal', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    await storage.put('proposal', proposal as string, { ...record, status: 'Active', activatedAt: new Date().toISOString() });
    return { variant: 'activated', proposal };
  },

  async advance(input, storage) {
    const { proposal, newStatus } = input;
    const record = await storage.get('proposal', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    await storage.put('proposal', proposal as string, { ...record, status: newStatus, advancedAt: new Date().toISOString() });
    return { variant: 'advanced', proposal, status: newStatus };
  },

  async cancel(input, storage) {
    const { proposal, reason } = input;
    const record = await storage.get('proposal', proposal as string);
    if (!record) return { variant: 'not_found', proposal };
    await storage.put('proposal', proposal as string, { ...record, status: 'Cancelled', cancelReason: reason });
    return { variant: 'cancelled', proposal };
  },
};
