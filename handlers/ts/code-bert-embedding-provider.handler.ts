// ============================================================
// CodeBERTEmbeddingProvider Handler
//
// Embedding model provider using CodeBERT for local, open-source
// code embeddings. Runs without network access after initial model
// download.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `code-bert-embedding-provider-${++idCounter}`;
}

const MODEL_NAME = 'codeBERT';
const PROVIDER_REF = 'embedding:codeBERT';

export const codeBERTEmbeddingProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    // Check if already initialised
    const existing = await storage.find('code-bert-embedding-provider', { providerRef: PROVIDER_REF });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    const id = nextId();
    await storage.put('code-bert-embedding-provider', id, {
      id,
      providerRef: PROVIDER_REF,
      modelName: MODEL_NAME,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetCodeBERTEmbeddingProviderCounter(): void {
  idCounter = 0;
}
