// ============================================================
// SelectionPipelineDependenceProvider Handler
//
// Cross-system dependence analysis provider for the Clef Surface
// selection pipeline. Computes the full dependency chain:
// concept state field -> interactor classification -> affordance
// matching -> widget resolution.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `selection-pipeline-dependence-provider-${++idCounter}`;
}

export const selectionPipelineDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:selection-pipeline`;

    // Check if already registered
    const existing = await storage.find('selection-pipeline-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('selection-pipeline-dependence-provider', id, {
      id,
      providerRef,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'selection-pipeline',
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSelectionPipelineDependenceProviderCounter(): void {
  idCounter = 0;
}
