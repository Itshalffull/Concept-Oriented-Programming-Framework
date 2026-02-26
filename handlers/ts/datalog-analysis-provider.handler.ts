// ============================================================
// DatalogAnalysisProvider Handler
//
// Analysis engine provider for Datalog-based rules. Evaluates
// Datalog programs over extracted program facts to derive
// analysis findings via fixpoint computation.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `datalog-analysis-provider-${++idCounter}`;
}

export const datalogAnalysisProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `analysis-engine:datalog`;
    const engineType = 'datalog';

    // Check if already registered
    const existing = await storage.find('datalog-analysis-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this engine provider in storage
    await storage.put('datalog-analysis-provider', id, {
      id,
      providerRef,
      engineType,
    });

    // Also register in the plugin registry relation so other concepts can discover it
    await storage.put('plugin-registry', `analysis-engine:${id}`, {
      id: `analysis-engine:${id}`,
      pluginKind: 'analysis-engine',
      engineType,
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDatalogAnalysisProviderCounter(): void {
  idCounter = 0;
}
