// ============================================================
// PatternMatchAnalysisProvider Handler
//
// Analysis engine provider for structural pattern matching.
// Delegates to StructuralPattern for AST-level pattern queries,
// enabling code smell detection and convention enforcement.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `pattern-match-analysis-provider-${++idCounter}`;
}

export const patternMatchAnalysisProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = `analysis-engine:pattern-match`;
    const engineType = 'pattern-match';

    // Check if already registered
    const existing = await storage.find('pattern-match-analysis-provider', { providerRef });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    // Register this engine provider in storage
    await storage.put('pattern-match-analysis-provider', id, {
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
export function resetPatternMatchAnalysisProviderCounter(): void {
  idCounter = 0;
}
