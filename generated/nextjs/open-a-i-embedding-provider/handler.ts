// OpenAIEmbeddingProvider — handler.ts
// OpenAI embedding provider: initializes an OpenAI text-embedding pipeline
// for generating dense vector representations of code and documentation.
// Validates API configuration, selects the appropriate embedding model
// (text-embedding-3-small/large, ada-002), and registers instance metadata.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  OpenAIEmbeddingProviderStorage,
  OpenAIEmbeddingProviderInitializeInput,
  OpenAIEmbeddingProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface OpenAIEmbeddingProviderError {
  readonly code: string;
  readonly message: string;
}

export interface OpenAIEmbeddingProviderHandler {
  readonly initialize: (
    input: OpenAIEmbeddingProviderInitializeInput,
    storage: OpenAIEmbeddingProviderStorage,
  ) => TE.TaskEither<OpenAIEmbeddingProviderError, OpenAIEmbeddingProviderInitializeOutput>;
}

// --- OpenAI embedding model configurations ---

interface ModelConfig {
  readonly modelId: string;
  readonly dimensions: number;
  readonly maxTokens: number;
  readonly supportsShortening: boolean;
}

const MODELS: Readonly<Record<string, ModelConfig>> = {
  'text-embedding-3-small': {
    modelId: 'text-embedding-3-small',
    dimensions: 1536,
    maxTokens: 8191,
    supportsShortening: true,
  },
  'text-embedding-3-large': {
    modelId: 'text-embedding-3-large',
    dimensions: 3072,
    maxTokens: 8191,
    supportsShortening: true,
  },
  'text-embedding-ada-002': {
    modelId: 'text-embedding-ada-002',
    dimensions: 1536,
    maxTokens: 8191,
    supportsShortening: false,
  },
};

/** Default model selection */
const DEFAULT_MODEL = 'text-embedding-3-small';

/** Provider instance prefix */
const PROVIDER_PREFIX = 'openai-embedding';

/** Storage relation name */
const RELATION = 'openaiembeddingprovider';

const storageError = (error: unknown): OpenAIEmbeddingProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a deterministic instance ID */
const generateInstanceId = (modelId: string, timestamp: number): string =>
  `${PROVIDER_PREFIX}-${modelId.replace(/[^a-z0-9]/g, '-')}-${timestamp.toString(36)}`;

/** Validate a cached instance record against current model config */
const validateCachedInstance = (
  record: Record<string, unknown> | null,
): O.Option<string> =>
  pipe(
    O.fromNullable(record),
    O.chain((r) => {
      const instanceId = r['instanceId'];
      const modelId = r['modelId'];
      const status = r['status'];
      if (
        typeof instanceId === 'string' &&
        typeof modelId === 'string' &&
        MODELS[modelId] !== undefined &&
        status === 'initialized'
      ) {
        return O.some(instanceId);
      }
      return O.none;
    }),
  );

/** Resolve model configuration from stored preferences or defaults */
const resolveModel = async (
  storage: OpenAIEmbeddingProviderStorage,
): Promise<ModelConfig> => {
  const prefs = await storage.get(RELATION, 'preferences');
  const preferredModel = pipe(
    O.fromNullable(prefs),
    O.chain((p) => {
      const model = p['model'];
      return typeof model === 'string' && MODELS[model] !== undefined
        ? O.some(model)
        : O.none;
    }),
    O.getOrElse(() => DEFAULT_MODEL),
  );
  return MODELS[preferredModel] ?? MODELS[DEFAULT_MODEL]!;
};

// --- Implementation ---

export const openAIEmbeddingProviderHandler: OpenAIEmbeddingProviderHandler = {
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check for an existing cached provider instance
          const cached = await storage.get(RELATION, 'singleton');

          return pipe(
            validateCachedInstance(cached),
            O.fold(
              // No valid cache: initialize a new provider
              async () => {
                const model = await resolveModel(storage);
                const instanceId = generateInstanceId(model.modelId, Date.now());

                // Validate API key availability (stored as config, not the key itself)
                const apiConfig = await storage.get(RELATION, 'apiConfig');
                const hasApiKey = pipe(
                  O.fromNullable(apiConfig),
                  O.chain((c) =>
                    typeof c['apiKeyConfigured'] === 'boolean' && c['apiKeyConfigured']
                      ? O.some(true)
                      : O.none,
                  ),
                  O.isSome,
                );

                if (!hasApiKey) {
                  // Still register but mark as unconfigured -- API key can be set later
                }

                // Persist provider instance
                await storage.put(RELATION, 'singleton', {
                  instanceId,
                  modelId: model.modelId,
                  dimensions: model.dimensions,
                  maxTokens: model.maxTokens,
                  supportsShortening: model.supportsShortening,
                  apiKeyConfigured: hasApiKey,
                  status: 'initialized',
                  createdAt: Date.now(),
                });

                // Store capabilities for downstream consumers
                await storage.put(RELATION, `capabilities:${instanceId}`, {
                  model: model.modelId,
                  dimensions: model.dimensions,
                  maxTokens: model.maxTokens,
                  supportsShortening: model.supportsShortening,
                  batchSupport: true,
                  encoding: 'float',
                  normalization: 'l2',
                });

                return initializeOk(instanceId);
              },
              // Valid cache: return existing instance
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
