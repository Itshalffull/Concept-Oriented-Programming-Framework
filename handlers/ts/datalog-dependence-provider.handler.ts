// ============================================================
// DatalogDependenceProvider Handler
//
// Dependence analysis provider using Datalog for declarative
// analysis from extracted program facts. Wraps a Datalog
// evaluation engine for fixpoint computation over dependency
// relations.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `datalog-dependence-provider-${++idCounter}`;
}

export const datalogDependenceProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `dependence-provider:datalog`;

    // Check if already registered
    const existing = await storage.find('datalog-dependence-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this provider in storage
    await storage.put('datalog-dependence-provider', id, {
      id,
      providerRef,
    });

    // Register in the plugin registry for discovery by dependence graph computation
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      id: `dependence-provider:${id}`,
      pluginKind: 'dependence-provider',
      domain: 'datalog',
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDatalogDependenceProviderCounter(): void {
  idCounter = 0;
}
