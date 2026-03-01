// ThemeDependenceProvider — Extracts dependency edges from theme specifications,
// tracking token references, inherited parent themes, imported token sets,
// and semantic alias chains to compute the theme dependency graph.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ThemeDependenceProviderStorage,
  ThemeDependenceProviderInitializeInput,
  ThemeDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface ThemeDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

interface ThemeEdge {
  readonly themeName: string;
  readonly from: string;
  readonly to: string;
  readonly kind: 'extends' | 'imports' | 'token-ref' | 'alias';
}

// --- Helpers ---

const storageError = (error: unknown): ThemeDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `tdp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Parse a theme spec (JSON) and extract dependency edges.
const parseThemeDeps = (specBody: string): readonly ThemeEdge[] => {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(specBody);
  } catch {
    return [];
  }

  const themeName = String(spec['name'] ?? '');
  if (themeName === '') return [];

  const edges: ThemeEdge[] = [];

  // Parent theme (extends)
  const extendsRef = spec['extends'];
  if (typeof extendsRef === 'string' && extendsRef !== '') {
    edges.push({ themeName, from: themeName, to: extendsRef, kind: 'extends' });
  }

  // Imported token sets
  const imports = spec['imports'];
  if (Array.isArray(imports)) {
    for (const imp of imports) {
      const ref = typeof imp === 'string'
        ? imp
        : String((imp as Record<string, unknown>)?.['theme'] ?? '');
      if (ref !== '') {
        edges.push({ themeName, from: themeName, to: ref, kind: 'imports' });
      }
    }
  }

  // Token values that reference other tokens (e.g. "{colors.primary}")
  const tokens = spec['tokens'];
  if (tokens !== null && typeof tokens === 'object' && !Array.isArray(tokens)) {
    const walkTokens = (obj: Record<string, unknown>, prefix: string): void => {
      for (const [key, value] of Object.entries(obj)) {
        const tokenPath = prefix !== '' ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
          // Check for token references like "{colors.primary}" or "{base.spacing.4}"
          const refMatch = value.match(/\{([^}]+)\}/g);
          if (refMatch !== null) {
            for (const ref of refMatch) {
              const refName = ref.slice(1, -1); // Remove braces
              edges.push({
                themeName,
                from: `${themeName}.${tokenPath}`,
                to: refName,
                kind: 'token-ref',
              });
            }
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          walkTokens(value as Record<string, unknown>, tokenPath);
        }
      }
    };
    walkTokens(tokens as Record<string, unknown>, '');
  }

  // Semantic aliases
  const aliases = spec['aliases'] ?? spec['semantic'];
  if (aliases !== null && typeof aliases === 'object' && !Array.isArray(aliases)) {
    for (const [aliasName, aliasValue] of Object.entries(aliases as Record<string, unknown>)) {
      if (typeof aliasValue === 'string') {
        edges.push({
          themeName,
          from: `${themeName}.alias.${aliasName}`,
          to: aliasValue,
          kind: 'alias',
        });
      }
    }
  }

  return edges;
};

// BFS for transitive theme dependencies
const bfsForward = (start: string, edges: readonly ThemeEdge[]): readonly string[] => {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const existing = adj.get(e.from) ?? [];
    adj.set(e.from, [...existing, e.to]);
  }
  const visited = new Set<string>();
  const queue = [start];
  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current !== start) result.push(current);
    for (const n of adj.get(current) ?? []) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return result;
};

// Compute the inheritance chain of a theme
const getInheritanceChain = (
  themeName: string,
  edges: readonly ThemeEdge[],
): readonly string[] => {
  const extendsEdges = edges.filter((e) => e.kind === 'extends');
  const chain: string[] = [];
  let current = themeName;
  const visited = new Set<string>();

  while (!visited.has(current)) {
    visited.add(current);
    const parent = extendsEdges.find((e) => e.from === current);
    if (parent === undefined) break;
    chain.push(parent.to);
    current = parent.to;
  }

  return chain;
};

// --- Handler interface ---

export interface ThemeDependenceProviderHandler {
  readonly initialize: (
    input: ThemeDependenceProviderInitializeInput,
    storage: ThemeDependenceProviderStorage,
  ) => TE.TaskEither<ThemeDependenceProviderError, ThemeDependenceProviderInitializeOutput>;
  readonly addThemeSpec: (
    input: { readonly specBody: string },
    storage: ThemeDependenceProviderStorage,
  ) => TE.TaskEither<ThemeDependenceProviderError, { readonly edgesAdded: number }>;
  readonly getDependencies: (
    input: { readonly theme: string },
    storage: ThemeDependenceProviderStorage,
  ) => TE.TaskEither<ThemeDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getInheritanceChain: (
    input: { readonly theme: string },
    storage: ThemeDependenceProviderStorage,
  ) => TE.TaskEither<ThemeDependenceProviderError, { readonly chain: readonly string[] }>;
  readonly getTokenReferences: (
    input: { readonly theme: string },
    storage: ThemeDependenceProviderStorage,
  ) => TE.TaskEither<ThemeDependenceProviderError, { readonly references: readonly { readonly from: string; readonly to: string }[] }>;
  readonly getTransitiveDependencies: (
    input: { readonly theme: string },
    storage: ThemeDependenceProviderStorage,
  ) => TE.TaskEither<ThemeDependenceProviderError, { readonly dependencies: readonly string[] }>;
}

// --- Implementation ---

export const themeDependenceProviderHandler: ThemeDependenceProviderHandler = {
  // Load existing theme edges and verify storage.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const edges = await storage.find('theme_edges');
          await storage.put('theme_dep_instances', instanceId, {
            id: instanceId,
            edgeCount: edges.length,
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

  // Parse a theme spec and store its dependency edges.
  addThemeSpec: (input, storage) =>
    pipe(
      TE.of(parseThemeDeps(input.specBody)),
      TE.chain((edges) =>
        TE.tryCatch(
          async () => {
            for (const edge of edges) {
              const edgeId = `${edge.themeName}:${edge.from}:${edge.to}:${edge.kind}`;
              await storage.put('theme_edges', edgeId, {
                themeName: edge.themeName,
                from: edge.from,
                to: edge.to,
                kind: edge.kind,
                id: edgeId,
                createdAt: nowISO(),
              });
            }
            return { edgesAdded: edges.length };
          },
          storageError,
        ),
      ),
    ),

  // Direct dependencies of a theme.
  getDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_edges', { themeName: input.theme }),
        storageError,
      ),
      TE.map((records) => ({
        dependencies: [...new Set(records
          .filter((r) => String(r['kind'] ?? '') === 'extends' || String(r['kind'] ?? '') === 'imports')
          .map((r) => String(r['to'] ?? '')))],
      })),
    ),

  // Compute the extends chain from child to root.
  getInheritanceChain: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly ThemeEdge[] = records.map((r) => ({
          themeName: String(r['themeName'] ?? ''),
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: (r['kind'] as ThemeEdge['kind']) ?? 'extends',
        }));
        return { chain: getInheritanceChain(input.theme, edges) };
      }),
    ),

  // Get all token-level references within a theme.
  getTokenReferences: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_edges', { themeName: input.theme }),
        storageError,
      ),
      TE.map((records) => ({
        references: records
          .filter((r) => String(r['kind'] ?? '') === 'token-ref' || String(r['kind'] ?? '') === 'alias')
          .map((r) => ({
            from: String(r['from'] ?? ''),
            to: String(r['to'] ?? ''),
          })),
      })),
    ),

  // Transitive dependencies through the full theme edge graph.
  getTransitiveDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly ThemeEdge[] = records.map((r) => ({
          themeName: String(r['themeName'] ?? ''),
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: (r['kind'] as ThemeEdge['kind']) ?? 'extends',
        }));
        return { dependencies: bfsForward(input.theme, edges) };
      }),
    ),
};
