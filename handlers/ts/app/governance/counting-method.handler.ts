// CountingMethod Concept Handler
// Coordination concept routing vote aggregation to pluggable counting providers.
import type { ConceptHandler } from '@clef/runtime';

export const countingMethodHandler: ConceptHandler = {
  async register(input, storage) {
    const id = `counting-${Date.now()}`;
    await storage.put('counting', id, { id, name: input.name, providerRef: input.providerRef });
    return { variant: 'registered', method: id };
  },

  async aggregate(input, storage) {
    const { method, ballots, weights } = input;
    const record = await storage.get('counting', method as string);
    if (!record) return { variant: 'not_found', method };
    // Stub: delegates to provider in real implementation
    return { variant: 'result', outcome: 'stub_result', details: '{}' };
  },

  async deregister(input, storage) {
    const { method } = input;
    await storage.del('counting', method as string);
    return { variant: 'deregistered', method };
  },
};
