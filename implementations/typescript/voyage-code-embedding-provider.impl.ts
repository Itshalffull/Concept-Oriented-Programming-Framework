// ============================================================
// VoyageCodeEmbeddingProvider Handler
//
// Embedding model provider using Voyage AI's voyage-code-3 model.
// Code-optimised embeddings with superior performance on code
// search tasks. Requires network access and API key.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `voyage-code-embedding-provider-${++idCounter}`;
}

const MODEL_NAME = 'voyage-code';
const PROVIDER_REF = 'embedding:voyage-code';

export const voyageCodeEmbeddingProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    // Check if already initialised
    const existing = await storage.find('voyage-code-embedding-provider', { providerRef: PROVIDER_REF });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    const id = nextId();
    await storage.put('voyage-code-embedding-provider', id, {
      id,
      providerRef: PROVIDER_REF,
      modelName: MODEL_NAME,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetVoyageCodeEmbeddingProviderCounter(): void {
  idCounter = 0;
}
