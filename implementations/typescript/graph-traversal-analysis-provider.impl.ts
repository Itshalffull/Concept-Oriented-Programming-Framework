// ============================================================
// GraphTraversalAnalysisProvider Handler
//
// Analysis engine provider for graph reachability queries.
// Evaluates rules by traversing Graph overlays (flow-graph,
// call-graph, import-graph, dependence-graph) to find
// reachability violations and structural patterns.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `graph-traversal-analysis-provider-${++idCounter}`;
}

export const graphTraversalAnalysisProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `analysis-engine:graph-traversal`;
    const engineType = 'graph-traversal';

    // Check if already registered
    const existing = await storage.find('graph-traversal-analysis-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this engine provider in storage
    await storage.put('graph-traversal-analysis-provider', id, {
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
export function resetGraphTraversalAnalysisProviderCounter(): void {
  idCounter = 0;
}
