// ============================================================
// BindingDependenceProvider Handler
//
// Dependence analysis provider for runtime data bindings.
// Computes the full binding chain: concept state field ->
// reactive signal -> widget prop, enabling impact analysis
// from schema changes to rendered UI.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `binding-dependence-provider-${++idCounter}`;
}

export const bindingDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:binding`;

    // Check if already registered
    const existing = await storage.find('binding-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('binding-dependence-provider', id, {
      id,
      providerRef,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'binding',
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetBindingDependenceProviderCounter(): void {
  idCounter = 0;
}
