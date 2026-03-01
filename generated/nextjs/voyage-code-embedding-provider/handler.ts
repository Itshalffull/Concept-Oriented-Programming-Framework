// VoyageCodeEmbeddingProvider — handler.ts
// Voyage AI code embedding provider: initializes a Voyage AI embedding pipeline
// optimized for source code retrieval and similarity search. Supports voyage-code-3
// and voyage-code-2 models with code-aware tokenization, multi-language coverage,
// and configurable embedding dimensions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VoyageCodeEmbeddingProviderStorage,
  VoyageCodeEmbeddingProviderInitializeInput,
  VoyageCodeEmbeddingProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface VoyageCodeEmbeddingProviderError {
  readonly code: string;
  readonly message: string;
}

export interface VoyageCodeEmbeddingProviderHandler {
  readonly initialize: (
    input: VoyageCodeEmbeddingProviderInitializeInput,
    storage: VoyageCodeEmbeddingProviderStorage,
  ) => TE.TaskEither<VoyageCodeEmbeddingProviderError, VoyageCodeEmbeddingProviderInitializeOutput>;
}

// --- Voyage AI model configurations ---

interface VoyageModelConfig {
  readonly modelId: string;
  readonly dimensions: number;
  readonly maxTokens: number;
  readonly contextWindow: number;
  readonly codeOptimized: boolean;
}

const VOYAGE_MODELS: Readonly<Record<string, VoyageModelConfig>> = {
  'voyage-code-3': {
    modelId: 'voyage-code-3',
    dimensions: 1024,
    maxTokens: 16000,
    contextWindow: 16000,
    codeOptimized: true,
  },
  'voyage-code-2': {
    modelId: 'voyage-code-2',
    dimensions: 1536,
    maxTokens: 16000,
    contextWindow: 16000,
    codeOptimized: true,
  },
  'voyage-3': {
    modelId: 'voyage-3',
    dimensions: 1024,
    maxTokens: 32000,
    contextWindow: 32000,
    codeOptimized: false,
  },
};

/** Default model for code embeddings */
const DEFAULT_MODEL = 'voyage-code-3';

/** Languages Voyage code models handle well */
const SUPPORTED_LANGUAGES: readonly string[] = [
  'python', 'javascript', 'typescript', 'java', 'go', 'rust',
  'c', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin', 'scala',
  'haskell', 'lua', 'r', 'julia', 'shell', 'sql', 'html', 'css',
];

/** Provider instance prefix */
const PROVIDER_PREFIX = 'voyage-code-embedding';

/** Storage relation name */
const RELATION = 'voyagecodeembeddingprovider';

const storageError = (error: unknown): VoyageCodeEmbeddingProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a deterministic instance ID */
const generateInstanceId = (modelId: string, timestamp: number): string =>
  `${PROVIDER_PREFIX}-${modelId.replace(/[^a-z0-9]/g, '-')}-${timestamp.toString(36)}`;

/** Validate a cached instance record */
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
        VOYAGE_MODELS[modelId] !== undefined &&
        status === 'initialized'
      ) {
        return O.some(instanceId);
      }
      return O.none;
    }),
  );

/** Resolve model configuration from stored preferences */
const resolveModel = async (
  storage: VoyageCodeEmbeddingProviderStorage,
): Promise<VoyageModelConfig> => {
  const prefs = await storage.get(RELATION, 'preferences');
  const preferredModel = pipe(
    O.fromNullable(prefs),
    O.chain((p) => {
      const model = p['model'];
      return typeof model === 'string' && VOYAGE_MODELS[model] !== undefined
        ? O.some(model)
        : O.none;
    }),
    O.getOrElse(() => DEFAULT_MODEL),
  );
  return VOYAGE_MODELS[preferredModel] ?? VOYAGE_MODELS[DEFAULT_MODEL]!;
};

/** Resolve custom dimension override (Voyage supports dimension shortening) */
const resolveDimensions = (
  prefs: Record<string, unknown> | null,
  modelConfig: VoyageModelConfig,
): number =>
  pipe(
    O.fromNullable(prefs),
    O.chain((p) => {
      const dim = p['dimensions'];
      return typeof dim === 'number' && dim > 0 && dim <= modelConfig.dimensions
        ? O.some(dim)
        : O.none;
    }),
    O.getOrElse(() => modelConfig.dimensions),
  );

// --- Implementation ---

export const voyageCodeEmbeddingProviderHandler: VoyageCodeEmbeddingProviderHandler = {
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check for existing cached provider instance
          const cached = await storage.get(RELATION, 'singleton');

          return pipe(
            validateCachedInstance(cached),
            O.fold(
              // No valid cache: initialize new provider
              async () => {
                const model = await resolveModel(storage);
                const prefs = await storage.get(RELATION, 'preferences');
                const dimensions = resolveDimensions(prefs, model);
                const instanceId = generateInstanceId(model.modelId, Date.now());

                // Validate model configuration
                if (model.dimensions <= 0 || model.maxTokens <= 0) {
                  return initializeLoadError(
                    `Invalid Voyage model configuration: ${model.modelId}`,
                  );
                }

                // Persist provider instance
                await storage.put(RELATION, 'singleton', {
                  instanceId,
                  modelId: model.modelId,
                  dimensions,
                  maxTokens: model.maxTokens,
                  contextWindow: model.contextWindow,
                  codeOptimized: model.codeOptimized,
                  status: 'initialized',
                  createdAt: Date.now(),
                });

                // Store capabilities metadata
                await storage.put(RELATION, `capabilities:${instanceId}`, {
                  model: model.modelId,
                  dimensions,
                  maxTokens: model.maxTokens,
                  contextWindow: model.contextWindow,
                  codeOptimized: model.codeOptimized,
                  supportedLanguages: [...SUPPORTED_LANGUAGES],
                  batchSupport: true,
                  inputTypes: ['query', 'document'],
                  normalization: 'l2',
                  truncation: 'end',
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
