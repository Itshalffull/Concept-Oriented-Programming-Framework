// DatalogDependenceProvider — Encodes dependency relationships as Datalog facts,
// defines transitive dependency rules, and queries the computed relation set
// for dependency analysis using logical inference.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DatalogDependenceProviderStorage,
  DatalogDependenceProviderInitializeInput,
  DatalogDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface DatalogDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

interface DepFact {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
}

// --- Helpers ---

const storageError = (error: unknown): DatalogDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `ddp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Compute the transitive closure of dependency facts using repeated joins.
// depends(A, C) :- depends(A, B), depends(B, C).
const transitiveClose = (facts: readonly DepFact[]): readonly DepFact[] => {
  const factSet = new Map<string, DepFact>();
  for (const f of facts) {
    factSet.set(`${f.from}->${f.to}`, f);
  }

  let changed = true;
  let iterations = 0;
  const maxIter = 100;

  while (changed && iterations < maxIter) {
    changed = false;
    iterations++;

    const current = [...factSet.values()];
    for (const f1 of current) {
      for (const f2 of current) {
        if (f1.to === f2.from) {
          const key = `${f1.from}->${f2.to}`;
          if (!factSet.has(key) && f1.from !== f2.to) {
            factSet.set(key, {
              from: f1.from,
              to: f2.to,
              kind: 'transitive',
            });
            changed = true;
          }
        }
      }
    }
  }

  return [...factSet.values()];
};

// Detect cycles: nodes that appear in their own transitive closure
const detectCycles = (facts: readonly DepFact[]): readonly string[] => {
  const closed = transitiveClose(facts);
  const cycleNodes = new Set<string>();
  for (const f of closed) {
    if (f.from === f.to) cycleNodes.add(f.from);
  }
  // Also detect through mutual reachability
  for (const f1 of closed) {
    for (const f2 of closed) {
      if (f1.from === f2.to && f1.to === f2.from) {
        cycleNodes.add(f1.from);
        cycleNodes.add(f1.to);
      }
    }
  }
  return [...cycleNodes];
};

// --- Handler interface ---

export interface DatalogDependenceProviderHandler {
  readonly initialize: (
    input: DatalogDependenceProviderInitializeInput,
    storage: DatalogDependenceProviderStorage,
  ) => TE.TaskEither<DatalogDependenceProviderError, DatalogDependenceProviderInitializeOutput>;
  readonly addDependency: (
    input: { readonly from: string; readonly to: string; readonly kind: string },
    storage: DatalogDependenceProviderStorage,
  ) => TE.TaskEither<DatalogDependenceProviderError, { readonly added: boolean }>;
  readonly queryDependencies: (
    input: { readonly from: string },
    storage: DatalogDependenceProviderStorage,
  ) => TE.TaskEither<DatalogDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly queryTransitiveDependencies: (
    input: { readonly from: string },
    storage: DatalogDependenceProviderStorage,
  ) => TE.TaskEither<DatalogDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly queryDependents: (
    input: { readonly to: string },
    storage: DatalogDependenceProviderStorage,
  ) => TE.TaskEither<DatalogDependenceProviderError, { readonly dependents: readonly string[] }>;
  readonly detectCycles: (
    storage: DatalogDependenceProviderStorage,
  ) => TE.TaskEither<DatalogDependenceProviderError, { readonly hasCycle: boolean; readonly cycleNodes: readonly string[] }>;
}

// --- Implementation ---

export const datalogDependenceProviderHandler: DatalogDependenceProviderHandler = {
  // Load existing dependency facts and verify storage.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const facts = await storage.find('dep_facts');
          await storage.put('dep_instances', instanceId, {
            id: instanceId,
            factCount: facts.length,
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

  // Assert a direct dependency fact: depends(from, to, kind).
  addDependency: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = `${input.from}->${input.to}`;
          const existing = await storage.get('dep_facts', key);
          if (existing !== null) return { added: false };
          await storage.put('dep_facts', key, {
            from: input.from,
            to: input.to,
            kind: input.kind,
            key,
            createdAt: nowISO(),
          });
          return { added: true };
        },
        storageError,
      ),
    ),

  // Direct dependencies from a given node (one hop).
  queryDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('dep_facts', { from: input.from }),
        storageError,
      ),
      TE.map((records) => ({
        dependencies: [...new Set(records.map((r) => String(r['to'] ?? '')))],
      })),
    ),

  // Transitive dependencies: compute closure and filter by source.
  queryTransitiveDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('dep_facts'),
        storageError,
      ),
      TE.map((records) => {
        const facts: readonly DepFact[] = records.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: String(r['kind'] ?? 'direct'),
        }));
        const closed = transitiveClose(facts);
        const deps = closed
          .filter((f) => f.from === input.from && f.to !== input.from)
          .map((f) => f.to);
        return { dependencies: [...new Set(deps)] };
      }),
    ),

  // Reverse query: who depends on the given node.
  queryDependents: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('dep_facts', { to: input.to }),
        storageError,
      ),
      TE.map((records) => ({
        dependents: [...new Set(records.map((r) => String(r['from'] ?? '')))],
      })),
    ),

  // Detect circular dependencies in the fact set.
  detectCycles: (storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('dep_facts'),
        storageError,
      ),
      TE.map((records) => {
        const facts: readonly DepFact[] = records.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: String(r['kind'] ?? 'direct'),
        }));
        const cycleNodes = detectCycles(facts);
        return { hasCycle: cycleNodes.length > 0, cycleNodes };
      }),
    ),
};
