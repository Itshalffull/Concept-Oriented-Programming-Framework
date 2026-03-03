// Monitor Concept Handler
// Compliance assessment (Ostrom DP4).
import type { ConceptHandler } from '@clef/runtime';

export const monitorHandler: ConceptHandler = {
  async watch(input, storage) {
    const id = `monitor-${Date.now()}`;
    await storage.put('monitor', id, {
      id, subject: input.subject, policyRef: input.policyRef,
      interval: input.interval, status: 'Active', startedAt: new Date().toISOString(),
    });
    return { variant: 'watching', observer: id };
  },

  async observe(input, storage) {
    const { observer, evidence } = input;
    const record = await storage.get('monitor', observer as string);
    if (!record) return { variant: 'not_found', observer };
    // Stub: real impl evaluates evidence against policy
    return { variant: 'compliant', observer };
  },

  async resolve(input, storage) {
    const { observer, outcome } = input;
    const record = await storage.get('monitor', observer as string);
    if (!record) return { variant: 'not_found', observer };
    await storage.put('monitor', observer as string, { ...record, lastOutcome: outcome, lastResolvedAt: new Date().toISOString() });
    return { variant: 'resolved', observer, outcome };
  },
};
