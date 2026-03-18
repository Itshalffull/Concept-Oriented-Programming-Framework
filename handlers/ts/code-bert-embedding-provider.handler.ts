// ============================================================
// CodeBERTEmbeddingProvider Handler — Functional Style
//
// Embedding model provider using CodeBERT for local, open-source
// code embeddings. Uses perform("onnx", "infer", ...) to declare
// transport effects — actual ONNX inference is resolved by the
// execution layer (LocalProcess → OnnxProvider → LocalModelInstance).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, find, pure, perform,
  type StorageProgram,
} from '../../runtime/storage-program.ts';

const MODEL_NAME = 'codeBERT';
const PROVIDER_REF = 'embedding:codeBERT';

let idCounter = 0;
function nextId(): string {
  return `code-bert-embedding-provider-${++idCounter}`;
}

export const codeBERTEmbeddingProviderHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'code-bert-embedding-provider', id, {
      id,
      providerRef: PROVIDER_REF,
      modelName: MODEL_NAME,
    });
    p = pure(p, { variant: 'ok', instance: id });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  embed(input: Record<string, unknown>) {
    const text = input.text as string;

    let p = createProgram();

    // Declare the ONNX transport effect — resolved by the execution layer:
    // perform → EffectHandler → LocalProcess → OnnxProvider → LocalModelInstance
    p = perform(p, 'onnx', 'infer', {
      session: 'codebert-base',
      inputs: JSON.stringify({
        input_ids: text,
        attention_mask: text,
      }),
      options: '{}',
    }, 'inferResult');

    p = pure(p, {
      variant: 'ok',
      vector: '',
      dimensions: 768,
      model: MODEL_NAME,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetCodeBERTEmbeddingProviderCounter(): void {
  idCounter = 0;
}
