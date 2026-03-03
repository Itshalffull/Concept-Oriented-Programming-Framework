// DisclosurePolicy Concept Handler
// Governance transparency and disclosure timing rules.
import type { ConceptHandler } from '@clef/runtime';

export const disclosurePolicyHandler: ConceptHandler = {
  async define(input, storage) {
    const id = `disclosure-${Date.now()}`;
    await storage.put('disclosure', id, {
      id, scope: input.scope, timing: input.timing,
      audience: input.audience, format: input.format ?? null,
      status: 'Active', createdAt: new Date().toISOString(),
    });
    return { variant: 'defined', policy: id };
  },

  async evaluate(input, storage) {
    const { policy, event, requestor } = input;
    const record = await storage.get('disclosure', policy as string);
    if (!record) return { variant: 'not_found', policy };
    if (record.status !== 'Active') return { variant: 'suspended', policy };
    // Stub: real impl checks audience and timing rules
    return { variant: 'disclosable', policy, disclosedTo: requestor };
  },

  async suspend(input, storage) {
    const { policy, reason } = input;
    const record = await storage.get('disclosure', policy as string);
    if (!record) return { variant: 'not_found', policy };
    await storage.put('disclosure', policy as string, { ...record, status: 'Suspended', suspendReason: reason });
    return { variant: 'suspended', policy };
  },
};
