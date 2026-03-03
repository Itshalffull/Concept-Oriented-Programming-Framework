// Membership Concept Handler
// Manage members joining, leaving, and participating in a governed polity.
import type { ConceptHandler } from '@clef/runtime';

export const membershipHandler: ConceptHandler = {
  async join(input, storage) {
    const member = input.member as string;
    const polity = input.polity as string;
    const existing = await storage.get('member', member);
    if (existing) return { variant: 'already_member', member };
    await storage.put('member', member, { member, polity, status: 'Active', joinedAt: new Date().toISOString() });
    return { variant: 'joined', membership: member };
  },

  async leave(input, storage) {
    const member = input.member as string;
    const record = await storage.get('member', member);
    if (!record) return { variant: 'not_found', member };
    await storage.del('member', member);
    return { variant: 'left', member };
  },

  async suspend(input, storage) {
    const member = input.member as string;
    const record = await storage.get('member', member);
    if (!record) return { variant: 'not_found', member };
    await storage.put('member', member, { ...record, status: 'Suspended', suspendedUntil: input.until });
    return { variant: 'suspended', member };
  },

  async reinstate(input, storage) {
    const member = input.member as string;
    const record = await storage.get('member', member);
    if (!record) return { variant: 'not_found', member };
    await storage.put('member', member, { ...record, status: 'Active', suspendedUntil: null });
    return { variant: 'reinstated', member };
  },

  async kick(input, storage) {
    const member = input.member as string;
    const record = await storage.get('member', member);
    if (!record) return { variant: 'not_found', member };
    await storage.del('member', member);
    return { variant: 'kicked', member };
  },

  async updateRules(input, storage) {
    const polity = input.polity as string;
    await storage.put('rules', polity, { joinConditions: input.joinConditions, exitConditions: input.exitConditions });
    return { variant: 'updated', polity };
  },
};
