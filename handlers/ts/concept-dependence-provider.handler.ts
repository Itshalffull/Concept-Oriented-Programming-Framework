// ============================================================
// ConceptDependenceProvider Handler
//
// Dependence analysis provider for .concept files. Extracts
// state field type references and capability requirements
// as dependency edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `concept-dependence-provider-${++idCounter}`;
}

export const conceptDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:concept`;
    const handledLanguages = 'concept';

    // Check if already registered
    const existing = await storage.find('concept-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('concept-dependence-provider', id, {
      id,
      providerRef,
      handledLanguages,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'concept',
      handledLanguages,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConceptDependenceProviderCounter(): void {
  idCounter = 0;
}
