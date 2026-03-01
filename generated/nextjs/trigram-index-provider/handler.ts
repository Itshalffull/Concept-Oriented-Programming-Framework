// Trigram-based code search index — fast substring matching via 3-character n-gram decomposition.
// Builds an inverted index of trigrams to document IDs for efficient approximate and exact search.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TrigramIndexProviderStorage,
  TrigramIndexProviderInitializeInput,
  TrigramIndexProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TrigramIndexProviderError {
  readonly code: string;
  readonly message: string;
}

export interface TrigramIndexProviderHandler {
  readonly initialize: (
    input: TrigramIndexProviderInitializeInput,
    storage: TrigramIndexProviderStorage,
  ) => TE.TaskEither<TrigramIndexProviderError, TrigramIndexProviderInitializeOutput>;
}

// --- Pure helpers ---

/** Decompose a string into its set of trigrams (3-character substrings) */
const extractTrigrams = (text: string): readonly string[] => {
  if (text.length < 3) {
    return [];
  }
  const trigrams = new Set<string>();
  const normalized = text.toLowerCase();
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }
  return [...trigrams].sort();
};

/** Compute trigram similarity between query and candidate (Jaccard coefficient) */
const trigramSimilarity = (
  queryTrigrams: readonly string[],
  candidateTrigrams: readonly string[],
): number => {
  if (queryTrigrams.length === 0 && candidateTrigrams.length === 0) {
    return 1.0;
  }
  if (queryTrigrams.length === 0 || candidateTrigrams.length === 0) {
    return 0.0;
  }
  const querySet = new Set(queryTrigrams);
  const candidateSet = new Set(candidateTrigrams);
  let intersection = 0;
  for (const t of querySet) {
    if (candidateSet.has(t)) {
      intersection++;
    }
  }
  const union = querySet.size + candidateSet.size - intersection;
  return union === 0 ? 0.0 : intersection / union;
};

/** Build the initial inverted index structure metadata */
const buildIndexMetadata = (): Record<string, unknown> => ({
  indexType: 'trigram-inverted',
  trigramSize: 3,
  normalization: 'lowercase',
  similarityMetric: 'jaccard',
  defaultThreshold: 0.3,
  maxDocuments: 100000,
  supportsExactMatch: true,
  supportsFuzzyMatch: true,
});

/** Validate that the trigram extraction engine produces consistent results */
const validateTrigramEngine = (): O.Option<string> => {
  // Self-test: "abc" should produce exactly ["abc"]
  const testResult = extractTrigrams('abc');
  if (testResult.length !== 1 || testResult[0] !== 'abc') {
    return O.some('Trigram engine self-test failed: "abc" did not produce expected trigram');
  }

  // Self-test: "abcd" should produce ["abc", "bcd"]
  const testResult2 = extractTrigrams('abcd');
  if (testResult2.length !== 2) {
    return O.some('Trigram engine self-test failed: "abcd" did not produce 2 trigrams');
  }

  // Self-test: similarity("abc", "abc") should be 1.0
  const sim = trigramSimilarity(extractTrigrams('abc'), extractTrigrams('abc'));
  if (sim !== 1.0) {
    return O.some('Trigram similarity self-test failed: identical inputs did not produce 1.0');
  }

  return O.none;
};

const toStorageError = (error: unknown): TrigramIndexProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const trigramIndexProviderHandler: TrigramIndexProviderHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateTrigramEngine(),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `trigram-index-${Date.now()}`;
                const metadata = buildIndexMetadata();

                // Persist the index instance
                await storage.put('indexes', instanceId, {
                  instanceId,
                  ...metadata,
                  documentCount: 0,
                  trigramCount: 0,
                  initializedAt: new Date().toISOString(),
                });

                // Persist a seed entry for the inverted posting list structure
                await storage.put('posting_lists', `${instanceId}:__meta__`, {
                  indexId: instanceId,
                  totalPostings: 0,
                  lastUpdated: new Date().toISOString(),
                });

                return initializeOk(instanceId);
              },
              toStorageError,
            ),
          ),
        (errorMsg) => TE.right(initializeLoadError(errorMsg)),
      ),
    ),
};
