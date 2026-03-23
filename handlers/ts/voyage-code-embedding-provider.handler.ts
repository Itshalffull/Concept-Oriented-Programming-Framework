// @clef-handler style=functional
// ============================================================
// VoyageCodeEmbeddingProvider Handler — Functional Style
//
// Embedding model provider using Voyage AI's voyage-code-3 model.
// Code-optimised embeddings. Uses perform("http", "POST", ...) to
// declare transport effects — actual HTTP calls are resolved by the
// execution layer (ExternalCall → HttpProvider → VoyageEndpoint).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, find, pure, perform,
  type StorageProgram,
  complete,
} from '../../runtime/storage-program.ts';

const MODEL_NAME = 'voyage-code';
const PROVIDER_REF = 'embedding:voyage-code';

let idCounter = 0;
function nextId(): string {
  return `voyage-code-embedding-provider-${++idCounter}`;
}

export const voyageCodeEmbeddingProviderHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'voyage-code-embedding-provider', id, {
      id,
      providerRef: PROVIDER_REF,
      modelName: MODEL_NAME,
    });
    p = complete(p, 'ok', { instance: id });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  embed(input: Record<string, unknown>) {
    const text = input.text as string;
    const model = (input.model as string) || 'voyage-code-3';
    const inputType = (input.inputType as string) || 'document';

    let p = createProgram();

    // Declare the HTTP transport effect — resolved by the execution layer:
    // perform → EffectHandler → ExternalCall → HttpProvider → VoyageEndpoint
    p = perform(p, 'http', 'POST', {
      endpoint: 'voyage-code-embeddings',
      path: '/embeddings',
      body: JSON.stringify({
        model,
        input: text,
        input_type: inputType,
      }),
    }, 'apiResponse');

    p = complete(p, 'ok', { vector: '',
      dimensions: 1024,
      model: MODEL_NAME });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetVoyageCodeEmbeddingProviderCounter(): void {
  idCounter = 0;
}
