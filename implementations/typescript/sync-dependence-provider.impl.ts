// ============================================================
// SyncDependenceProvider Handler
//
// Dependence analysis provider for .sync files. Extracts
// when-clause to then-clause data flow and cross-sync
// triggering chains as dependency edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `sync-dependence-provider-${++idCounter}`;
}

export const syncDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:sync`;
    const handledLanguages = 'sync';

    // Check if already registered
    const existing = await storage.find('sync-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('sync-dependence-provider', id, {
      id,
      providerRef,
      handledLanguages,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'sync',
      handledLanguages,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSyncDependenceProviderCounter(): void {
  idCounter = 0;
}
