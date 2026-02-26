// ============================================================
// OpenAIEmbeddingProvider Handler
//
// Embedding model provider using OpenAI's text-embedding-3-large
// API. Requires network access and API key.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `open-ai-embedding-provider-${++idCounter}`;
}

const MODEL_NAME = 'openai-code';
const PROVIDER_REF = 'embedding:openai-code';

export const openAIEmbeddingProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    // Check if already initialised
    const existing = await storage.find('open-ai-embedding-provider', { providerRef: PROVIDER_REF });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    const id = nextId();
    await storage.put('open-ai-embedding-provider', id, {
      id,
      providerRef: PROVIDER_REF,
      modelName: MODEL_NAME,
    });

    return { variant: 'ok', instance: id };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetOpenAIEmbeddingProviderCounter(): void {
  idCounter = 0;
}
