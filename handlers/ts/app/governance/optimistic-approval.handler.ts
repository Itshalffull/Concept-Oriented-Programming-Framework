// OptimisticApproval Concept Handler
// Approve-unless-challenged pattern with bond mechanics — @gate concept.
import type { ConceptHandler } from '@clef/runtime';

export const optimisticApprovalHandler: ConceptHandler = {
  async assert(input, storage) {
    const id = `assertion-${Date.now()}`;
    const expiresAt = new Date(Date.now() + (input.challengePeriodHours as number) * 3600000).toISOString();
    await storage.put('assertion', id, {
      id, asserter: input.asserter, payload: input.payload, bond: input.bond,
      challengePeriodHours: input.challengePeriodHours,
      assertedAt: new Date().toISOString(), expiresAt, status: 'Pending',
    });
    return { variant: 'asserted', assertion: id };
  },

  async challenge(input, storage) {
    const { assertion, challenger, bond, evidence } = input;
    const record = await storage.get('assertion', assertion as string);
    if (!record) return { variant: 'not_found', assertion };
    if (new Date() > new Date(record.expiresAt as string)) return { variant: 'expired', assertion };
    await storage.put('assertion', assertion as string, { ...record, status: 'Challenged', challenger, challengerBond: bond });
    return { variant: 'challenged', assertion };
  },

  async finalize(input, storage) {
    const { assertion } = input;
    const record = await storage.get('assertion', assertion as string);
    if (!record) return { variant: 'not_found', assertion };
    if (record.status !== 'Pending') return { variant: 'not_pending', assertion };
    await storage.put('assertion', assertion as string, { ...record, status: 'Approved' });
    return { variant: 'approved', assertion };
  },

  async resolve(input, storage) {
    const { assertion, upheld } = input;
    const record = await storage.get('assertion', assertion as string);
    if (!record) return { variant: 'not_found', assertion };
    const status = upheld ? 'Rejected' : 'Approved';
    await storage.put('assertion', assertion as string, { ...record, status });
    return upheld
      ? { variant: 'rejected', assertion }
      : { variant: 'approved', assertion };
  },
};
