// ImmediateFinality Provider
// Confirms operations instantly with duplicate detection.
import type { ConceptHandler } from '@clef/runtime';

export const immediateFinalityHandler: ConceptHandler = {
  async confirm(input, storage) {
    const opRef = input.operationRef as string;

    // Duplicate check: same operation can't be finalized twice
    const existing = await storage.find('imm_final', { operationRef: opRef });
    if (existing.length > 0) {
      return { variant: 'already_finalized', confirmation: existing[0].id as string };
    }

    const id = `imm-${Date.now()}`;
    await storage.put('imm_final', id, {
      id,
      operationRef: opRef,
      confirmedAt: new Date().toISOString(),
    });

    await storage.put('plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'ImmediateFinality',
      instanceId: id,
    });

    return { variant: 'finalized', confirmation: id };
  },
};
