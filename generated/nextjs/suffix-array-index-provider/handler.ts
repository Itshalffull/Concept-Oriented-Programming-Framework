// SuffixArrayIndexProvider — Builds suffix arrays for text corpora,
// supports O(m log n) substring search via binary search, and computes
// LCP (Longest Common Prefix) arrays for repeated substring analysis.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SuffixArrayIndexProviderStorage,
  SuffixArrayIndexProviderInitializeInput,
  SuffixArrayIndexProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface SuffixArrayIndexProviderError {
  readonly code: string;
  readonly message: string;
}

interface SuffixArrayData {
  readonly text: string;
  readonly suffixArray: readonly number[];
  readonly lcpArray: readonly number[];
}

interface SearchResult {
  readonly position: number;
  readonly context: string;
}

// --- Helpers ---

const storageError = (error: unknown): SuffixArrayIndexProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `saip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Build suffix array via simple comparison sort (suitable for moderate-size texts).
// Returns array of starting indices sorted by their corresponding suffixes.
const buildSuffixArray = (text: string): readonly number[] => {
  const n = text.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => {
    const sa = text.slice(a);
    const sb = text.slice(b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  });
  return indices;
};

// Build LCP array using Kasai's algorithm in O(n).
const buildLcpArray = (text: string, sa: readonly number[]): readonly number[] => {
  const n = text.length;
  if (n === 0) return [];

  // Build inverse suffix array: rank[i] = position of suffix i in SA
  const rank = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    rank[sa[i]] = i;
  }

  const lcp = new Array<number>(n).fill(0);
  let k = 0;

  for (let i = 0; i < n; i++) {
    if (rank[i] === 0) {
      k = 0;
      continue;
    }

    const j = sa[rank[i] - 1];
    while (i + k < n && j + k < n && text[i + k] === text[j + k]) {
      k++;
    }

    lcp[rank[i]] = k;
    if (k > 0) k--;
  }

  return lcp;
};

// Binary search for substring in suffix array
const searchSubstring = (
  text: string,
  sa: readonly number[],
  pattern: string,
): readonly number[] => {
  const n = sa.length;
  const m = pattern.length;
  if (m === 0 || n === 0) return [];

  // Find lower bound
  let lo = 0;
  let hi = n - 1;
  let start = n;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const suffix = text.slice(sa[mid], sa[mid] + m);
    if (suffix >= pattern) {
      start = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // Find upper bound
  lo = start;
  hi = n - 1;
  let end = start - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const suffix = text.slice(sa[mid], sa[mid] + m);
    if (suffix <= pattern) {
      end = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (start > end) return [];

  const positions: number[] = [];
  for (let i = start; i <= end; i++) {
    positions.push(sa[i]);
  }
  return positions.sort((a, b) => a - b);
};

// Extract context around a position
const extractContext = (text: string, position: number, windowSize: number = 40): string => {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  return text.slice(start, end);
};

// Find longest repeated substring using LCP array
const longestRepeatedSubstring = (text: string, sa: readonly number[], lcp: readonly number[]): string => {
  if (lcp.length === 0) return '';
  let maxLen = 0;
  let maxIdx = 0;
  for (let i = 0; i < lcp.length; i++) {
    if (lcp[i] > maxLen) {
      maxLen = lcp[i];
      maxIdx = sa[i];
    }
  }
  return text.slice(maxIdx, maxIdx + maxLen);
};

// --- Handler interface ---

export interface SuffixArrayIndexProviderHandler {
  readonly initialize: (
    input: SuffixArrayIndexProviderInitializeInput,
    storage: SuffixArrayIndexProviderStorage,
  ) => TE.TaskEither<SuffixArrayIndexProviderError, SuffixArrayIndexProviderInitializeOutput>;
  readonly buildIndex: (
    input: { readonly docId: string; readonly text: string },
    storage: SuffixArrayIndexProviderStorage,
  ) => TE.TaskEither<SuffixArrayIndexProviderError, { readonly arrayLength: number }>;
  readonly search: (
    input: { readonly docId: string; readonly pattern: string },
    storage: SuffixArrayIndexProviderStorage,
  ) => TE.TaskEither<SuffixArrayIndexProviderError, { readonly results: readonly SearchResult[] }>;
  readonly longestRepeated: (
    input: { readonly docId: string },
    storage: SuffixArrayIndexProviderStorage,
  ) => TE.TaskEither<SuffixArrayIndexProviderError, { readonly substring: string; readonly length: number }>;
}

// --- Implementation ---

export const suffixArrayIndexProviderHandler: SuffixArrayIndexProviderHandler = {
  // Verify storage and load existing index metadata.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const indices = await storage.find('suffix_arrays');
          await storage.put('sa_instances', instanceId, {
            id: instanceId,
            indexCount: indices.length,
            createdAt: nowISO(),
          });
          return instanceId;
        },
        storageError,
      ),
      TE.map((instanceId) => initializeOk(instanceId)),
      TE.orElse((err) =>
        TE.right(initializeLoadError(err.message)),
      ),
    ),

  // Build a suffix array and LCP array for a document and persist them.
  buildIndex: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const sa = buildSuffixArray(input.text);
          const lcp = buildLcpArray(input.text, sa);

          await storage.put('suffix_arrays', input.docId, {
            docId: input.docId,
            text: input.text,
            suffixArray: JSON.stringify(sa),
            lcpArray: JSON.stringify(lcp),
            length: sa.length,
            createdAt: nowISO(),
          });

          return { arrayLength: sa.length };
        },
        storageError,
      ),
    ),

  // Search for all occurrences of a substring pattern in an indexed document.
  search: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('suffix_arrays', input.docId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<SuffixArrayIndexProviderError, { readonly results: readonly SearchResult[] }>({
              code: 'NOT_FOUND',
              message: `No index found for document ${input.docId}`,
            }),
            (r) => {
              const text = String(r['text'] ?? '');
              const sa: readonly number[] = JSON.parse(String(r['suffixArray'] ?? '[]'));
              const positions = searchSubstring(text, sa, input.pattern);
              const results: SearchResult[] = positions.map((pos) => ({
                position: pos,
                context: extractContext(text, pos),
              }));
              return TE.right<SuffixArrayIndexProviderError, { readonly results: readonly SearchResult[] }>({
                results,
              });
            },
          ),
        ),
      ),
    ),

  // Find the longest repeated substring in an indexed document using the LCP array.
  longestRepeated: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('suffix_arrays', input.docId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<SuffixArrayIndexProviderError, { readonly substring: string; readonly length: number }>({
              code: 'NOT_FOUND',
              message: `No index found for document ${input.docId}`,
            }),
            (r) => {
              const text = String(r['text'] ?? '');
              const sa: readonly number[] = JSON.parse(String(r['suffixArray'] ?? '[]'));
              const lcp: readonly number[] = JSON.parse(String(r['lcpArray'] ?? '[]'));
              const lrs = longestRepeatedSubstring(text, sa, lcp);
              return TE.right<SuffixArrayIndexProviderError, { readonly substring: string; readonly length: number }>({
                substring: lrs,
                length: lrs.length,
              });
            },
          ),
        ),
      ),
    ),
};
