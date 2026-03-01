// CodeBERTEmbeddingProvider — handler.ts
// CodeBERT code embedding provider: initializes a CodeBERT-based embedding
// pipeline for generating dense vector representations of source code.
// Validates model configuration, checks cached model state, and registers
// the provider instance with supported languages and embedding dimensions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CodeBERTEmbeddingProviderStorage,
  CodeBERTEmbeddingProviderInitializeInput,
  CodeBERTEmbeddingProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface CodeBERTEmbeddingProviderError {
  readonly code: string;
  readonly message: string;
}

export interface CodeBERTEmbeddingProviderHandler {
  readonly initialize: (
    input: CodeBERTEmbeddingProviderInitializeInput,
    storage: CodeBERTEmbeddingProviderStorage,
  ) => TE.TaskEither<CodeBERTEmbeddingProviderError, CodeBERTEmbeddingProviderInitializeOutput>;
}

// --- CodeBERT model configuration ---

/** CodeBERT model identifier */
const MODEL_ID = 'microsoft/codebert-base';

/** CodeBERT embedding output dimensionality */
const EMBEDDING_DIM = 768;

/** Maximum input token length for CodeBERT */
const MAX_SEQUENCE_LENGTH = 512;

/** Languages supported by CodeBERT's pre-training */
const SUPPORTED_LANGUAGES: readonly string[] = [
  'python', 'javascript', 'java', 'php', 'ruby', 'go',
  'typescript', 'c', 'c++', 'c#', 'rust', 'scala', 'swift',
  'kotlin', 'haskell',
];

/** Provider instance ID prefix */
const PROVIDER_PREFIX = 'codebert-embedding';

const storageError = (error: unknown): CodeBERTEmbeddingProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a deterministic instance ID for the provider */
const generateInstanceId = (timestamp: number): string =>
  `${PROVIDER_PREFIX}-${timestamp.toString(36)}`;

/** Validate that a previously cached instance is still valid */
const validateCachedInstance = (
  record: Record<string, unknown> | null,
): O.Option<string> =>
  pipe(
    O.fromNullable(record),
    O.chain((r) => {
      const instanceId = r['instanceId'];
      const modelId = r['modelId'];
      const dim = r['embeddingDim'];
      // Instance is valid if it references the correct model and dimension
      if (
        typeof instanceId === 'string' &&
        modelId === MODEL_ID &&
        dim === EMBEDDING_DIM
      ) {
        return O.some(instanceId);
      }
      return O.none;
    }),
  );

// --- Implementation ---

export const codeBERTEmbeddingProviderHandler: CodeBERTEmbeddingProviderHandler = {
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check for an existing cached provider instance
          const cached = await storage.get('codebertembeddingprovider', 'singleton');

          return pipe(
            validateCachedInstance(cached),
            O.fold(
              // No valid cache: create a new instance
              async () => {
                const instanceId = generateInstanceId(Date.now());

                // Validate that model configuration is internally consistent
                if (EMBEDDING_DIM <= 0 || MAX_SEQUENCE_LENGTH <= 0) {
                  return initializeLoadError(
                    `Invalid model configuration: dim=${EMBEDDING_DIM}, maxSeq=${MAX_SEQUENCE_LENGTH}`,
                  );
                }

                // Register the new provider instance
                await storage.put('codebertembeddingprovider', 'singleton', {
                  instanceId,
                  modelId: MODEL_ID,
                  embeddingDim: EMBEDDING_DIM,
                  maxSequenceLength: MAX_SEQUENCE_LENGTH,
                  supportedLanguages: [...SUPPORTED_LANGUAGES],
                  status: 'initialized',
                  createdAt: Date.now(),
                });

                // Store capability metadata for downstream consumers
                await storage.put('codebertembeddingprovider', `capabilities:${instanceId}`, {
                  dimensions: EMBEDDING_DIM,
                  maxTokens: MAX_SEQUENCE_LENGTH,
                  languages: [...SUPPORTED_LANGUAGES],
                  model: MODEL_ID,
                  batchSupport: true,
                  normalization: 'l2',
                });

                return initializeOk(instanceId);
              },
              // Valid cache exists: return existing instance
              async (existingId) => initializeOk(existingId),
            ),
          );
        },
        storageError,
      ),
      TE.chain((resultPromise) =>
        TE.tryCatch(
          () => resultPromise,
          storageError,
        ),
      ),
    ),
};
