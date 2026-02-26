// ============================================================
// UniversalTreeSitterDependenceProvider Handler
//
// Fallback dependence analysis provider using generic Tree-sitter
// queries. Provides basic import and call analysis for any
// language with a Tree-sitter grammar.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `universal-tree-sitter-dependence-provider-${++idCounter}`;
}

export const universalTreeSitterDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:universal-tree-sitter`;

    // Check if already registered
    const existing = await storage.find('universal-tree-sitter-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('universal-tree-sitter-dependence-provider', id, {
      id,
      providerRef,
    });

    // Register in the plugin registry as a fallback dependence provider
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'universal',
      fallback: true,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetUniversalTreeSitterDependenceProviderCounter(): void {
  idCounter = 0;
}
