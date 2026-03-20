// @clef-handler style=functional
// ============================================================
// OpenAIEmbeddingProvider Handler — Functional Style
//
// Embedding model provider using OpenAI's text-embedding-3-large
// API. Uses perform("http", "POST", ...) to declare transport
// effects — actual HTTP calls are resolved by the execution layer
// (ExternalCall → HttpProvider → OpenAiEndpoint).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, find, pure, perform,
  type StorageProgram,
} from '../../runtime/storage-program.ts';

const MODEL_NAME = 'openai-code';
const PROVIDER_REF = 'embedding:openai-code';

let idCounter = 0;
function nextId(): string {
  return `open-ai-embedding-provider-${++idCounter}`;
}

export const openAIEmbeddingProviderHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'open-ai-embedding-provider', id, {
      id,
      providerRef: PROVIDER_REF,
      modelName: MODEL_NAME,
    });
    p = pure(p, { variant: 'ok', instance: id });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  embed(input: Record<string, unknown>) {
    const text = input.text as string;
    const model = (input.model as string) || 'text-embedding-3-small';
    const dimensions = (input.dimensions as number) || 1536;

    let p = createProgram();

    // Declare the HTTP transport effect — resolved by the execution layer:
    // perform → EffectHandler → ExternalCall → HttpProvider → OpenAiEndpoint
    p = perform(p, 'http', 'POST', {
      endpoint: 'openai-embeddings',
      path: '/embeddings',
      body: JSON.stringify({
        model,
        input: text,
        dimensions,
      }),
    }, 'apiResponse');

    p = pure(p, {
      variant: 'ok',
      vector: '',
      dimensions,
      model: MODEL_NAME,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetOpenAIEmbeddingProviderCounter(): void {
  idCounter = 0;
}
