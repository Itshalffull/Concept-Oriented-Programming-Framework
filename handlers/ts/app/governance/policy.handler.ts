// Policy Concept Handler
// ADICO-encoded governance rules with deontic modality.
import type { ConceptHandler } from '@clef/runtime';

export const policyHandler: ConceptHandler = {
  async create(input, storage) {
    const id = `policy-${Date.now()}`;
    await storage.put('policy', id, {
      id, attributes: input.attributes, deontic: input.deontic,
      aim: input.aim, conditions: input.conditions, orElse: input.orElse ?? null,
      status: 'Active', createdAt: new Date().toISOString(),
    });
    return { variant: 'created', policy: id };
  },

  async evaluate(input, storage) {
    const { policy, context } = input;
    const record = await storage.get('policy', policy as string);
    if (!record) return { variant: 'not_found', policy };
    if (record.status !== 'Active') return { variant: 'suspended', policy };
    // Stub: real implementation delegates to PolicyEvaluator provider
    return { variant: 'compliant', policy };
  },

  async suspend(input, storage) {
    const { policy, reason } = input;
    const record = await storage.get('policy', policy as string);
    if (!record) return { variant: 'not_found', policy };
    await storage.put('policy', policy as string, { ...record, status: 'Suspended', suspendReason: reason });
    return { variant: 'suspended', policy };
  },

  async repeal(input, storage) {
    const { policy } = input;
    const record = await storage.get('policy', policy as string);
    if (!record) return { variant: 'not_found', policy };
    await storage.put('policy', policy as string, { ...record, status: 'Repealed' });
    return { variant: 'repealed', policy };
  },

  async modify(input, storage) {
    const { policy } = input;
    const record = await storage.get('policy', policy as string);
    if (!record) return { variant: 'not_found', policy };
    await storage.put('policy', policy as string, { ...record, ...input, updatedAt: new Date().toISOString() });
    return { variant: 'modified', policy };
  },
};
