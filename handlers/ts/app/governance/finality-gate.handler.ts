// FinalityGate Concept Handler
// Coordination concept wrapping external finality signals — @gate concept.
import type { ConceptHandler } from '@clef/runtime';

export const finalityGateHandler: ConceptHandler = {
  async submit(input, storage) {
    const id = `finality-${Date.now()}`;
    await storage.put('finality', id, {
      id, operationRef: input.operationRef, providerRef: input.providerRef,
      status: 'Pending', submittedAt: new Date().toISOString(),
    });
    return { variant: 'pending', gate: id };
  },

  async confirm(input, storage) {
    const { gate, proof } = input;
    const record = await storage.get('finality', gate as string);
    if (!record) return { variant: 'not_found', gate };
    await storage.put('finality', gate as string, { ...record, status: 'Finalized', proof, confirmedAt: new Date().toISOString() });
    return { variant: 'finalized', gate };
  },
};
