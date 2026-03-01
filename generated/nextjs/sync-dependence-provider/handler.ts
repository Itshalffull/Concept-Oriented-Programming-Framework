// SyncDependenceProvider — Extracts dependency edges from sync rule specifications,
// tracking which concepts are referenced by sync bindings, trigger conditions,
// and guard expressions to compute the sync dependency graph.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncDependenceProviderStorage,
  SyncDependenceProviderInitializeInput,
  SyncDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface SyncDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

interface SyncEdge {
  readonly syncName: string;
  readonly from: string;
  readonly to: string;
  readonly kind: 'binding' | 'trigger' | 'guard' | 'transform';
}

// --- Helpers ---

const storageError = (error: unknown): SyncDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `sdp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Parse a sync spec (JSON) and extract dependency edges between concepts.
const parseSyncDeps = (specBody: string): readonly SyncEdge[] => {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(specBody);
  } catch {
    return [];
  }

  const syncName = String(spec['name'] ?? '');
  if (syncName === '') return [];

  const edges: SyncEdge[] = [];

  // Bindings: source concept -> target concept
  const bindings = spec['bindings'];
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      if (typeof binding === 'object' && binding !== null) {
        const b = binding as Record<string, unknown>;
        const source = String(b['source'] ?? b['from'] ?? '');
        const target = String(b['target'] ?? b['to'] ?? '');
        if (source !== '' && target !== '') {
          edges.push({ syncName, from: source, to: target, kind: 'binding' });
        }
      }
    }
  }

  // Triggers: the triggering concept references
  const triggers = spec['triggers'];
  if (Array.isArray(triggers)) {
    for (const trigger of triggers) {
      const conceptRef = typeof trigger === 'string'
        ? trigger
        : String((trigger as Record<string, unknown>)?.['concept'] ?? '');
      if (conceptRef !== '') {
        edges.push({ syncName, from: conceptRef, to: syncName, kind: 'trigger' });
      }
    }
  }

  // Guards: concepts referenced in guard expressions
  const guards = spec['guards'];
  if (Array.isArray(guards)) {
    for (const guard of guards) {
      const conceptRef = typeof guard === 'string'
        ? guard
        : String((guard as Record<string, unknown>)?.['concept'] ?? '');
      if (conceptRef !== '') {
        edges.push({ syncName, from: conceptRef, to: syncName, kind: 'guard' });
      }
    }
  }

  // Transforms: concepts involved in data transformation
  const transforms = spec['transforms'];
  if (Array.isArray(transforms)) {
    for (const transform of transforms) {
      if (typeof transform === 'object' && transform !== null) {
        const t = transform as Record<string, unknown>;
        const source = String(t['source'] ?? t['input'] ?? '');
        const target = String(t['target'] ?? t['output'] ?? '');
        if (source !== '') edges.push({ syncName, from: source, to: syncName, kind: 'transform' });
        if (target !== '') edges.push({ syncName, from: syncName, to: target, kind: 'transform' });
      }
    }
  }

  return edges;
};

// Get all unique concept references from edges
const uniqueConcepts = (edges: readonly SyncEdge[]): readonly string[] => {
  const all = new Set<string>();
  for (const e of edges) {
    all.add(e.from);
    all.add(e.to);
  }
  return [...all];
};

// BFS to find transitive dependencies from a starting concept
const bfsForward = (start: string, edges: readonly SyncEdge[]): readonly string[] => {
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

// --- Handler interface ---

export interface SyncDependenceProviderHandler {
  readonly initialize: (
    input: SyncDependenceProviderInitializeInput,
    storage: SyncDependenceProviderStorage,
  ) => TE.TaskEither<SyncDependenceProviderError, SyncDependenceProviderInitializeOutput>;
  readonly addSyncSpec: (
    input: { readonly specBody: string },
    storage: SyncDependenceProviderStorage,
  ) => TE.TaskEither<SyncDependenceProviderError, { readonly edgesAdded: number; readonly conceptsFound: number }>;
  readonly getDependencies: (
    input: { readonly concept: string },
    storage: SyncDependenceProviderStorage,
  ) => TE.TaskEither<SyncDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getTransitiveDependencies: (
    input: { readonly concept: string },
    storage: SyncDependenceProviderStorage,
  ) => TE.TaskEither<SyncDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getSyncRulesForConcept: (
    input: { readonly concept: string },
    storage: SyncDependenceProviderStorage,
  ) => TE.TaskEither<SyncDependenceProviderError, { readonly syncNames: readonly string[] }>;
}

// --- Implementation ---

export const syncDependenceProviderHandler: SyncDependenceProviderHandler = {
  // Load existing sync edges and verify storage.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const edges = await storage.find('sync_edges');
          await storage.put('sync_dep_instances', instanceId, {
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

  // Parse a sync spec and store its dependency edges.
  addSyncSpec: (input, storage) =>
    pipe(
      TE.of(parseSyncDeps(input.specBody)),
      TE.chain((edges) =>
        TE.tryCatch(
          async () => {
            for (const edge of edges) {
              const edgeId = `${edge.syncName}:${edge.from}:${edge.to}:${edge.kind}`;
              await storage.put('sync_edges', edgeId, {
                syncName: edge.syncName,
                from: edge.from,
                to: edge.to,
                kind: edge.kind,
                id: edgeId,
                createdAt: nowISO(),
              });
            }
            const concepts = uniqueConcepts(edges);
            return { edgesAdded: edges.length, conceptsFound: concepts.length };
          },
          storageError,
        ),
      ),
    ),

  // Direct dependencies of a concept through sync edges.
  getDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_edges', { from: input.concept }),
        storageError,
      ),
      TE.map((records) => ({
        dependencies: [...new Set(records.map((r) => String(r['to'] ?? '')))],
      })),
    ),

  // Transitive dependencies through the sync edge graph.
  getTransitiveDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly SyncEdge[] = records.map((r) => ({
          syncName: String(r['syncName'] ?? ''),
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: (r['kind'] as SyncEdge['kind']) ?? 'binding',
        }));
        return { dependencies: bfsForward(input.concept, edges) };
      }),
    ),

  // Find all sync rules that reference a given concept (either as source or target).
  getSyncRulesForConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_edges'),
        storageError,
      ),
      TE.map((records) => {
        const syncNames = new Set<string>();
        for (const r of records) {
          const from = String(r['from'] ?? '');
          const to = String(r['to'] ?? '');
          if (from === input.concept || to === input.concept) {
            syncNames.add(String(r['syncName'] ?? ''));
          }
        }
        return { syncNames: [...syncNames] };
      }),
    ),
};
