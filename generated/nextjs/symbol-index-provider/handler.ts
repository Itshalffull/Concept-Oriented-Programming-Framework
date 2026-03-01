// SymbolIndexProvider — Maintains a fast-lookup index of symbols with support
// for exact match, prefix search, and fuzzy search across the full symbol
// corpus, with file-based partitioning and kind filtering.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SymbolIndexProviderStorage,
  SymbolIndexProviderInitializeInput,
  SymbolIndexProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface SymbolIndexProviderError {
  readonly code: string;
  readonly message: string;
}

interface IndexedSymbol {
  readonly name: string;
  readonly qualifiedName: string;
  readonly kind: string;
  readonly file: string;
  readonly exported: boolean;
}

// --- Helpers ---

const storageError = (error: unknown): SymbolIndexProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `sip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Compute edit distance (Levenshtein) for fuzzy matching
const editDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
};

// Check if a name matches a prefix (case-insensitive)
const matchesPrefix = (name: string, prefix: string): boolean =>
  name.toLowerCase().startsWith(prefix.toLowerCase());

// Check if a name fuzzy-matches a query (edit distance within threshold)
const fuzzyMatch = (name: string, query: string, maxDistance: number): boolean => {
  // For short queries, compare directly
  if (query.length <= 2) {
    return name.toLowerCase().includes(query.toLowerCase());
  }
  // For longer queries, use edit distance on the shortest prefix of name
  const slice = name.slice(0, Math.max(name.length, query.length + maxDistance));
  return editDistance(slice.toLowerCase(), query.toLowerCase()) <= maxDistance;
};

// Compute a relevance score for ranking search results
const computeScore = (symbol: IndexedSymbol, query: string): number => {
  const nameLower = symbol.name.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match is highest priority
  if (nameLower === queryLower) return 100;
  // Prefix match
  if (nameLower.startsWith(queryLower)) return 80;
  // Contains
  if (nameLower.includes(queryLower)) return 60;
  // Exported symbols ranked higher
  const exportBonus = symbol.exported ? 10 : 0;
  // Fuzzy similarity
  const dist = editDistance(nameLower, queryLower);
  const similarity = Math.max(0, 40 - dist * 5);

  return similarity + exportBonus;
};

// --- Handler interface ---

export interface SymbolIndexProviderHandler {
  readonly initialize: (
    input: SymbolIndexProviderInitializeInput,
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, SymbolIndexProviderInitializeOutput>;
  readonly addSymbol: (
    input: IndexedSymbol,
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, { readonly added: boolean }>;
  readonly removeSymbol: (
    input: { readonly qualifiedName: string },
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, { readonly removed: boolean }>;
  readonly exactLookup: (
    input: { readonly name: string },
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, { readonly symbols: readonly IndexedSymbol[] }>;
  readonly prefixSearch: (
    input: { readonly prefix: string; readonly limit: number },
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, { readonly symbols: readonly IndexedSymbol[] }>;
  readonly fuzzySearch: (
    input: { readonly query: string; readonly maxDistance: number; readonly limit: number },
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, { readonly symbols: readonly IndexedSymbol[] }>;
  readonly getByFile: (
    input: { readonly file: string },
    storage: SymbolIndexProviderStorage,
  ) => TE.TaskEither<SymbolIndexProviderError, { readonly symbols: readonly IndexedSymbol[] }>;
}

// --- Implementation ---

export const symbolIndexProviderHandler: SymbolIndexProviderHandler = {
  // Verify storage and count existing indexed symbols.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('symbol_index');
          await storage.put('index_instances', instanceId, {
            id: instanceId,
            symbolCount: existing.length,
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

  // Add a symbol to the index.
  addSymbol: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.put('symbol_index', input.qualifiedName, {
            name: input.name,
            qualifiedName: input.qualifiedName,
            kind: input.kind,
            file: input.file,
            exported: input.exported,
            nameLower: input.name.toLowerCase(),
            updatedAt: nowISO(),
          });
          return { added: true };
        },
        storageError,
      ),
    ),

  // Remove a symbol from the index by qualified name.
  removeSymbol: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const removed = await storage.delete('symbol_index', input.qualifiedName);
          return { removed };
        },
        storageError,
      ),
    ),

  // Exact name lookup (returns all symbols with that name across files).
  exactLookup: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('symbol_index'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => String(r['name'] ?? '') === input.name)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            qualifiedName: String(r['qualifiedName'] ?? ''),
            kind: String(r['kind'] ?? ''),
            file: String(r['file'] ?? ''),
            exported: Boolean(r['exported'] ?? false),
          })),
      })),
    ),

  // Prefix-based search: all symbols whose name starts with the given prefix.
  prefixSearch: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('symbol_index'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => matchesPrefix(String(r['name'] ?? ''), input.prefix))
          .slice(0, input.limit)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            qualifiedName: String(r['qualifiedName'] ?? ''),
            kind: String(r['kind'] ?? ''),
            file: String(r['file'] ?? ''),
            exported: Boolean(r['exported'] ?? false),
          })),
      })),
    ),

  // Fuzzy search: all symbols within edit distance, ranked by relevance score.
  fuzzySearch: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('symbol_index'),
        storageError,
      ),
      TE.map((records) => {
        const candidates = records
          .filter((r) => fuzzyMatch(String(r['name'] ?? ''), input.query, input.maxDistance))
          .map((r) => {
            const sym: IndexedSymbol = {
              name: String(r['name'] ?? ''),
              qualifiedName: String(r['qualifiedName'] ?? ''),
              kind: String(r['kind'] ?? ''),
              file: String(r['file'] ?? ''),
              exported: Boolean(r['exported'] ?? false),
            };
            return { sym, score: computeScore(sym, input.query) };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, input.limit)
          .map((c) => c.sym);
        return { symbols: candidates };
      }),
    ),

  // Get all symbols from a specific file.
  getByFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('symbol_index', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records.map((r) => ({
          name: String(r['name'] ?? ''),
          qualifiedName: String(r['qualifiedName'] ?? ''),
          kind: String(r['kind'] ?? ''),
          file: String(r['file'] ?? ''),
          exported: Boolean(r['exported'] ?? false),
        })),
      })),
    ),
};
