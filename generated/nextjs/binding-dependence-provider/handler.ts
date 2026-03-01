// BindingDependenceProvider — Extracts dependencies from binding declarations,
// resolves referenced concepts, and maintains a dependency edge set for
// binding-level analysis (which widgets bind to which concept fields).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  BindingDependenceProviderStorage,
  BindingDependenceProviderInitializeInput,
  BindingDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface BindingDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

interface BindingEdge {
  readonly source: string;
  readonly target: string;
  readonly bindingKind: string;
  readonly fieldPath: string;
}

interface BindingDeclaration {
  readonly widgetName: string;
  readonly conceptRef: string;
  readonly fieldPath: string;
  readonly direction: 'read' | 'write' | 'readwrite';
}

// --- Helpers ---

const storageError = (error: unknown): BindingDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `bdp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Parse a binding declaration from a raw record
const parseBindingDeclaration = (raw: Record<string, unknown>): O.Option<BindingDeclaration> =>
  pipe(
    O.fromNullable(raw['widgetName']),
    O.chain((widgetName) =>
      pipe(
        O.fromNullable(raw['conceptRef']),
        O.map((conceptRef) => ({
          widgetName: String(widgetName),
          conceptRef: String(conceptRef),
          fieldPath: String(raw['fieldPath'] ?? ''),
          direction: (['read', 'write', 'readwrite'].includes(String(raw['direction'] ?? ''))
            ? String(raw['direction']) as 'read' | 'write' | 'readwrite'
            : 'read'),
        })),
      ),
    ),
  );

// Extract edges from a set of binding declarations
const extractEdges = (declarations: readonly BindingDeclaration[]): readonly BindingEdge[] =>
  declarations.map((decl) => ({
    source: decl.widgetName,
    target: decl.conceptRef,
    bindingKind: decl.direction,
    fieldPath: decl.fieldPath,
  }));

// Compute transitive dependencies from edges using BFS
const computeTransitiveDeps = (
  startNode: string,
  edges: readonly BindingEdge[],
): readonly string[] => {
  const visited = new Set<string>();
  const queue: string[] = [startNode];
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current !== startNode) result.push(current);
    const neighbors = edges
      .filter((e) => e.source === current)
      .map((e) => e.target);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }

  return result;
};

// --- Handler interface ---

export interface BindingDependenceProviderHandler {
  readonly initialize: (
    input: BindingDependenceProviderInitializeInput,
    storage: BindingDependenceProviderStorage,
  ) => TE.TaskEither<BindingDependenceProviderError, BindingDependenceProviderInitializeOutput>;
  readonly addBinding: (
    input: { readonly widgetName: string; readonly conceptRef: string; readonly fieldPath: string; readonly direction: string },
    storage: BindingDependenceProviderStorage,
  ) => TE.TaskEither<BindingDependenceProviderError, { readonly edgeCount: number }>;
  readonly getDependencies: (
    input: { readonly widgetName: string },
    storage: BindingDependenceProviderStorage,
  ) => TE.TaskEither<BindingDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getTransitiveDependencies: (
    input: { readonly widgetName: string },
    storage: BindingDependenceProviderStorage,
  ) => TE.TaskEither<BindingDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getDependents: (
    input: { readonly conceptRef: string },
    storage: BindingDependenceProviderStorage,
  ) => TE.TaskEither<BindingDependenceProviderError, { readonly dependents: readonly string[] }>;
}

// --- Implementation ---

export const bindingDependenceProviderHandler: BindingDependenceProviderHandler = {
  // Load any previously-stored binding edges and verify storage is accessible.
  // Persists an instance record so downstream actions can reference this provider session.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('binding_edges');
          await storage.put('binding_instances', instanceId, {
            id: instanceId,
            edgeCount: existing.length,
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

  // Register a binding declaration, store the derived dependency edge,
  // and update the edge count on the instance.
  addBinding: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const decl = parseBindingDeclaration({
            widgetName: input.widgetName,
            conceptRef: input.conceptRef,
            fieldPath: input.fieldPath,
            direction: input.direction,
          });
          return decl;
        },
        storageError,
      ),
      TE.chain((declOpt) =>
        pipe(
          declOpt,
          O.fold(
            () => TE.left<BindingDependenceProviderError, { readonly edgeCount: number }>({
              code: 'INVALID_BINDING',
              message: 'Missing required fields widgetName or conceptRef',
            }),
            (decl) => {
              const edges = extractEdges([decl]);
              return TE.tryCatch(
                async () => {
                  for (const edge of edges) {
                    const edgeId = `${edge.source}:${edge.target}:${edge.fieldPath}`;
                    await storage.put('binding_edges', edgeId, {
                      ...edge,
                      id: edgeId,
                      createdAt: nowISO(),
                    });
                  }
                  const allEdges = await storage.find('binding_edges');
                  return { edgeCount: allEdges.length };
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Direct dependencies: all concepts referenced by a given widget through bindings.
  getDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('binding_edges', { source: input.widgetName }),
        storageError,
      ),
      TE.map((records) => {
        const targets = records.map((r) => String(r['target'] ?? ''));
        const unique = [...new Set(targets)];
        return { dependencies: unique };
      }),
    ),

  // Transitive dependencies: BFS through the full edge graph from the widget.
  getTransitiveDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('binding_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly BindingEdge[] = records.map((r) => ({
          source: String(r['source'] ?? ''),
          target: String(r['target'] ?? ''),
          bindingKind: String(r['bindingKind'] ?? 'read'),
          fieldPath: String(r['fieldPath'] ?? ''),
        }));
        const deps = computeTransitiveDeps(input.widgetName, edges);
        return { dependencies: deps };
      }),
    ),

  // Reverse lookup: all widgets that depend on a given concept.
  getDependents: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('binding_edges', { target: input.conceptRef }),
        storageError,
      ),
      TE.map((records) => {
        const sources = records.map((r) => String(r['source'] ?? ''));
        const unique = [...new Set(sources)];
        return { dependents: unique };
      }),
    ),
};
