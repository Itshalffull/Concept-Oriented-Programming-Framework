// ConceptDependenceProvider — Extracts concept-level dependencies from spec files,
// computes the full dependency graph between concepts, supports topological ordering,
// cycle detection, and transitive closure queries.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConceptDependenceProviderStorage,
  ConceptDependenceProviderInitializeInput,
  ConceptDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface ConceptDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

interface ConceptEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'uses' | 'extends' | 'composes' | 'references';
}

interface TopologicalResult {
  readonly sorted: readonly string[];
  readonly hasCycle: boolean;
  readonly cycleNodes: readonly string[];
}

// --- Helpers ---

const storageError = (error: unknown): ConceptDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `cdp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Parse concept references from a spec body (JSON-encoded concept spec)
const parseConceptRefs = (specBody: string): readonly ConceptEdge[] => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(specBody);
  } catch {
    return [];
  }

  const conceptName = String(parsed['name'] ?? '');
  if (conceptName === '') return [];

  const edges: ConceptEdge[] = [];

  // Extract "uses" dependencies
  const uses = parsed['uses'];
  if (Array.isArray(uses)) {
    for (const ref of uses) {
      edges.push({ from: conceptName, to: String(ref), kind: 'uses' });
    }
  }

  // Extract "extends" parent
  const extendsRef = parsed['extends'];
  if (typeof extendsRef === 'string' && extendsRef !== '') {
    edges.push({ from: conceptName, to: extendsRef, kind: 'extends' });
  }

  // Extract "composes" references
  const composes = parsed['composes'];
  if (Array.isArray(composes)) {
    for (const ref of composes) {
      edges.push({ from: conceptName, to: String(ref), kind: 'composes' });
    }
  }

  // Extract inline concept references from state field types
  const state = parsed['state'];
  if (state !== null && typeof state === 'object' && !Array.isArray(state)) {
    for (const [_fieldName, fieldDef] of Object.entries(state as Record<string, unknown>)) {
      if (typeof fieldDef === 'object' && fieldDef !== null) {
        const typeRef = (fieldDef as Record<string, unknown>)['conceptRef'];
        if (typeof typeRef === 'string' && typeRef !== '') {
          edges.push({ from: conceptName, to: typeRef, kind: 'references' });
        }
      }
    }
  }

  return edges;
};

// Topological sort using Kahn's algorithm, also detects cycles.
const topologicalSort = (nodes: readonly string[], edges: readonly ConceptEdge[]): TopologicalResult => {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node, 0);
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    if (!inDegree.has(edge.from)) { inDegree.set(edge.from, 0); adjacency.set(edge.from, []); }
    if (!inDegree.has(edge.to)) { inDegree.set(edge.to, 0); adjacency.set(edge.to, []); }
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  const allNodes = new Set([...nodes, ...edges.map((e) => e.from), ...edges.map((e) => e.to)]);
  const hasCycle = sorted.length < allNodes.size;
  const cycleNodes = hasCycle
    ? [...allNodes].filter((n) => !sorted.includes(n))
    : [];

  return { sorted, hasCycle, cycleNodes };
};

// BFS forward reachability
const bfsForward = (start: string, edges: readonly ConceptEdge[]): readonly string[] => {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = adj.get(edge.from) ?? [];
    adj.set(edge.from, [...existing, edge.to]);
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

export interface ConceptDependenceProviderHandler {
  readonly initialize: (
    input: ConceptDependenceProviderInitializeInput,
    storage: ConceptDependenceProviderStorage,
  ) => TE.TaskEither<ConceptDependenceProviderError, ConceptDependenceProviderInitializeOutput>;
  readonly addSpec: (
    input: { readonly specBody: string },
    storage: ConceptDependenceProviderStorage,
  ) => TE.TaskEither<ConceptDependenceProviderError, { readonly edgesAdded: number }>;
  readonly getDirectDependencies: (
    input: { readonly concept: string },
    storage: ConceptDependenceProviderStorage,
  ) => TE.TaskEither<ConceptDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getTransitiveDependencies: (
    input: { readonly concept: string },
    storage: ConceptDependenceProviderStorage,
  ) => TE.TaskEither<ConceptDependenceProviderError, { readonly dependencies: readonly string[] }>;
  readonly getTopologicalOrder: (
    storage: ConceptDependenceProviderStorage,
  ) => TE.TaskEither<ConceptDependenceProviderError, TopologicalResult>;
  readonly detectCycles: (
    storage: ConceptDependenceProviderStorage,
  ) => TE.TaskEither<ConceptDependenceProviderError, { readonly hasCycle: boolean; readonly cycleNodes: readonly string[] }>;
}

// --- Implementation ---

export const conceptDependenceProviderHandler: ConceptDependenceProviderHandler = {
  // Load existing concept edges from storage and verify accessibility.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('concept_edges');
          const concepts = await storage.find('concept_nodes');
          await storage.put('concept_dep_instances', instanceId, {
            id: instanceId,
            edgeCount: existing.length,
            nodeCount: concepts.length,
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

  // Parse a concept spec body, extract dependency edges, and persist them.
  addSpec: (input, storage) =>
    pipe(
      TE.of(parseConceptRefs(input.specBody)),
      TE.chain((edges) =>
        TE.tryCatch(
          async () => {
            for (const edge of edges) {
              const edgeId = `${edge.from}:${edge.to}:${edge.kind}`;
              await storage.put('concept_edges', edgeId, {
                id: edgeId,
                from: edge.from,
                to: edge.to,
                kind: edge.kind,
                createdAt: nowISO(),
              });
              // Ensure both nodes are registered
              await storage.put('concept_nodes', edge.from, { name: edge.from });
              await storage.put('concept_nodes', edge.to, { name: edge.to });
            }
            return { edgesAdded: edges.length };
          },
          storageError,
        ),
      ),
    ),

  // Direct dependencies of a concept (one-hop forward edges).
  getDirectDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_edges', { from: input.concept }),
        storageError,
      ),
      TE.map((records) => ({
        dependencies: [...new Set(records.map((r) => String(r['to'] ?? '')))],
      })),
    ),

  // Transitive dependencies using BFS through the edge set.
  getTransitiveDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly ConceptEdge[] = records.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: (r['kind'] as ConceptEdge['kind']) ?? 'uses',
        }));
        return { dependencies: bfsForward(input.concept, edges) };
      }),
    ),

  // Compute a topological ordering of all concepts.
  getTopologicalOrder: (storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const nodeRecords = await storage.find('concept_nodes');
          const edgeRecords = await storage.find('concept_edges');
          return { nodeRecords, edgeRecords };
        },
        storageError,
      ),
      TE.map(({ nodeRecords, edgeRecords }) => {
        const nodes = nodeRecords.map((r) => String(r['name'] ?? ''));
        const edges: readonly ConceptEdge[] = edgeRecords.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: (r['kind'] as ConceptEdge['kind']) ?? 'uses',
        }));
        return topologicalSort(nodes, edges);
      }),
    ),

  // Detect whether cycles exist in the concept dependency graph.
  detectCycles: (storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const nodeRecords = await storage.find('concept_nodes');
          const edgeRecords = await storage.find('concept_edges');
          return { nodeRecords, edgeRecords };
        },
        storageError,
      ),
      TE.map(({ nodeRecords, edgeRecords }) => {
        const nodes = nodeRecords.map((r) => String(r['name'] ?? ''));
        const edges: readonly ConceptEdge[] = edgeRecords.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          kind: (r['kind'] as ConceptEdge['kind']) ?? 'uses',
        }));
        const result = topologicalSort(nodes, edges);
        return { hasCycle: result.hasCycle, cycleNodes: result.cycleNodes };
      }),
    ),
};
