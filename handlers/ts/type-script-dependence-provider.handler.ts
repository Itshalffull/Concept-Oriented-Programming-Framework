// ============================================================
// TypeScriptDependenceProvider Handler
//
// Dependence analysis provider for TypeScript and TSX files.
// Uses the TypeScript compiler API for type-aware data and
// control dependency extraction.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `type-script-dependence-provider-${++idCounter}`;
}

export const typeScriptDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:typescript`;
    const handledLanguages = 'typescript,tsx';

    // Check if already registered
    const existing = await storage.find('type-script-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('type-script-dependence-provider', id, {
      id,
      providerRef,
      handledLanguages,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'typescript',
      handledLanguages,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptDependenceProviderCounter(): void {
  idCounter = 0;
}
