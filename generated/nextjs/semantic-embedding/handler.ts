// SemanticEmbedding — Code embedding vector computation and similarity search
// Computes vector embeddings for code units and supports nearest-neighbor queries.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  SemanticEmbeddingStorage,
  SemanticEmbeddingComputeInput,
  SemanticEmbeddingComputeOutput,
  SemanticEmbeddingSearchSimilarInput,
  SemanticEmbeddingSearchSimilarOutput,
  SemanticEmbeddingSearchNaturalLanguageInput,
  SemanticEmbeddingSearchNaturalLanguageOutput,
  SemanticEmbeddingGetInput,
  SemanticEmbeddingGetOutput,
} from './types.js';

import {
  computeOk,
  computeModelUnavailable,
  searchSimilarOk,
  searchNaturalLanguageOk,
  getOk,
  getNotfound,
} from './types.js';

export interface SemanticEmbeddingError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): SemanticEmbeddingError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SUPPORTED_MODELS: readonly string[] = [
  'openai-ada-002',
  'openai-3-small',
  'openai-3-large',
  'codeBERT',
  'voyage-code-2',
] as const;

/** Deterministic mock vector based on content and model for reproducibility. */
const computeVector = (content: string, dimensions: number): readonly number[] => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  const result: number[] = [];
  for (let d = 0; d < dimensions; d++) {
    hash = ((hash << 5) - hash + d) | 0;
    result.push(Math.abs(hash) / 2147483647);
  }
  return result;
};

/** Cosine similarity between two JSON-encoded vectors. */
const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

const dimensionsForModel = (model: string): number => {
  switch (model) {
    case 'openai-3-large': return 3072;
    case 'openai-3-small': return 1536;
    case 'codeBERT': return 768;
    default: return 1536;
  }
};

export interface SemanticEmbeddingHandler {
  readonly compute: (
    input: SemanticEmbeddingComputeInput,
    storage: SemanticEmbeddingStorage,
  ) => TE.TaskEither<SemanticEmbeddingError, SemanticEmbeddingComputeOutput>;
  readonly searchSimilar: (
    input: SemanticEmbeddingSearchSimilarInput,
    storage: SemanticEmbeddingStorage,
  ) => TE.TaskEither<SemanticEmbeddingError, SemanticEmbeddingSearchSimilarOutput>;
  readonly searchNaturalLanguage: (
    input: SemanticEmbeddingSearchNaturalLanguageInput,
    storage: SemanticEmbeddingStorage,
  ) => TE.TaskEither<SemanticEmbeddingError, SemanticEmbeddingSearchNaturalLanguageOutput>;
  readonly get: (
    input: SemanticEmbeddingGetInput,
    storage: SemanticEmbeddingStorage,
  ) => TE.TaskEither<SemanticEmbeddingError, SemanticEmbeddingGetOutput>;
}

// --- Implementation ---

export const semanticEmbeddingHandler: SemanticEmbeddingHandler = {
  compute: (input, storage) =>
    SUPPORTED_MODELS.includes(input.model)
      ? pipe(
          TE.tryCatch(
            async () => {
              const dims = dimensionsForModel(input.model);
              const vector = computeVector(input.unit, dims);
              const embeddingId = `emb_${input.unit}_${input.model}`;
              await storage.put('embedding', embeddingId, {
                id: embeddingId,
                unit: input.unit,
                model: input.model,
                dimensions: dims,
                vector: JSON.stringify(vector),
                createdAt: new Date().toISOString(),
              });
              return computeOk(embeddingId);
            },
            storageError,
          ),
        )
      : TE.right(computeModelUnavailable(input.model)),

  searchSimilar: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allEmbeddings = await storage.find('embedding', { kind: input.kind });
          const queryVec: readonly number[] = JSON.parse(input.queryVector);
          const scored = allEmbeddings
            .filter((rec) => String(rec['language'] ?? '') === input.language || input.language === '*')
            .map((rec) => {
              const storedVec: readonly number[] = JSON.parse(String(rec['vector'] ?? '[]'));
              return { id: String(rec['id']), score: cosineSimilarity(queryVec, storedVec) };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, input.topK);
          return searchSimilarOk(JSON.stringify(scored));
        },
        storageError,
      ),
    ),

  searchNaturalLanguage: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const queryVec = computeVector(input.query, 1536);
          const allEmbeddings = await storage.find('embedding');
          const scored = allEmbeddings
            .map((rec) => {
              const storedVec: readonly number[] = JSON.parse(String(rec['vector'] ?? '[]'));
              return { id: String(rec['id']), unit: String(rec['unit']), score: cosineSimilarity(queryVec, storedVec) };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, input.topK);
          return searchNaturalLanguageOk(JSON.stringify(scored));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('embedding', input.embedding),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['unit']),
                  String(found['model']),
                  Number(found['dimensions']),
                ),
              ),
          ),
        ),
      ),
    ),
};
