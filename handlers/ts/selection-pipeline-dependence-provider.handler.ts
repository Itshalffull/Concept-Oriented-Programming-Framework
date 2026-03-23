// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SelectionPipelineDependenceProvider Handler
//
// Cross-system dependence analysis provider for the Clef Surface
// selection pipeline. Computes the full dependency chain:
// concept state field -> interactor classification -> affordance
// matching -> widget resolution.
//
// Uses imperative style because initialize requires idempotent
// upsert with dynamic storage keys derived from find results.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `selection-pipeline-dependence-provider-${++idCounter}`;
}

const _handler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const providerRef = `dependence-provider:selection-pipeline`;

    // Check for existing provider
    const existing = await storage.find('selection-pipeline-dependence-provider', { providerRef });

    if (existing.length > 0) {
      const existingId = existing[0].id as string;
      return { variant: 'ok', instance: existingId, output: { instance: existingId } };
    }

    // Create new provider instance
    const id = nextId();
    await storage.put('selection-pipeline-dependence-provider', id, {
      id,
      providerRef,
    });

    // Register in plugin-registry
    await storage.put('plugin-registry', `dependence-provider:${id}`, {
      pluginKind: 'dependence-provider',
      domain: 'selection-pipeline',
      instanceId: id,
    });

    return { variant: 'ok', instance: id, output: { instance: id } };
  },
};

export const selectionPipelineDependenceProviderHandler = _handler;

/** Reset the ID counter. Useful for testing. */
export function resetSelectionPipelineDependenceProviderCounter(): void {
  idCounter = 0;
}
