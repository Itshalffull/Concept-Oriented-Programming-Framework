// GraphTraversalAnalysisProvider — Provides graph analysis algorithms:
// DFS, BFS, dominator tree computation, topological ordering, and
// strongly connected component detection on arbitrary directed graphs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GraphTraversalAnalysisProviderStorage,
  GraphTraversalAnalysisProviderInitializeInput,
  GraphTraversalAnalysisProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface GraphTraversalAnalysisProviderError {
  readonly code: string;
  readonly message: string;
}

interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

interface DfsResult {
  readonly visited: readonly string[];
  readonly preOrder: readonly string[];
  readonly postOrder: readonly string[];
  readonly backEdges: readonly GraphEdge[];
}

interface DominatorTree {
  readonly root: string;
  readonly dominators: ReadonlyMap<string, string>;
  readonly dominanceFrontier: ReadonlyMap<string, readonly string[]>;
}

// --- Helpers ---

const storageError = (error: unknown): GraphTraversalAnalysisProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `gtap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Build adjacency list from edges
const buildAdj = (edges: readonly GraphEdge[]): ReadonlyMap<string, readonly string[]> => {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from)!.push(edge.to);
  }
  return adj;
};

// Build reverse adjacency
const buildReverseAdj = (edges: readonly GraphEdge[]): ReadonlyMap<string, readonly string[]> => {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.to)!.push(edge.from);
  }
  return adj;
};

// Depth-first search returning pre/post order and back edges
const dfs = (start: string, adj: ReadonlyMap<string, readonly string[]>): DfsResult => {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const preOrder: string[] = [];
  const postOrder: string[] = [];
  const backEdges: GraphEdge[] = [];

  const visit = (node: string): void => {
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    preOrder.push(node);

    for (const neighbor of adj.get(node) ?? []) {
      if (inStack.has(neighbor)) {
        backEdges.push({ from: node, to: neighbor, label: 'back' });
      } else if (!visited.has(neighbor)) {
        visit(neighbor);
      }
    }

    inStack.delete(node);
    postOrder.push(node);
  };

  visit(start);
  return {
    visited: [...visited],
    preOrder,
    postOrder,
    backEdges,
  };
};

// BFS from a start node
const bfs = (start: string, adj: ReadonlyMap<string, readonly string[]>): readonly string[] => {
  const visited = new Set<string>();
  const queue = [start];
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    result.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }

  return result;
};

// Simple dominator computation using iterative dataflow
const computeDominators = (
  root: string,
  nodes: readonly string[],
  adj: ReadonlyMap<string, readonly string[]>,
  reverseAdj: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, string> => {
  // dom[n] = immediate dominator of n
  const dom = new Map<string, string>();
  dom.set(root, root);

  // Get reverse post-order using DFS
  const dfsResult = dfs(root, adj);
  const rpo = [...dfsResult.postOrder].reverse();

  // Intersect function for dominator sets
  const intersect = (b1: string, b2: string): string => {
    let f1 = b1;
    let f2 = b2;
    const indexOf = (n: string): number => rpo.indexOf(n);
    while (f1 !== f2) {
      while (indexOf(f1) > indexOf(f2)) {
        f1 = dom.get(f1) ?? root;
      }
      while (indexOf(f2) > indexOf(f1)) {
        f2 = dom.get(f2) ?? root;
      }
    }
    return f1;
  };

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;

    for (const node of rpo) {
      if (node === root) continue;
      const preds = (reverseAdj.get(node) ?? []).filter((p) => dom.has(p));
      if (preds.length === 0) continue;

      let newDom = preds[0];
      for (let i = 1; i < preds.length; i++) {
        newDom = intersect(newDom, preds[i]);
      }

      if (dom.get(node) !== newDom) {
        dom.set(node, newDom);
        changed = true;
      }
    }
  }

  return dom;
};

// Tarjan's SCC algorithm
const tarjanScc = (
  nodes: readonly string[],
  adj: ReadonlyMap<string, readonly string[]>,
): readonly (readonly string[])[] => {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  const strongConnect = (v: string): void => {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  };

  for (const node of nodes) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  return sccs;
};

// --- Handler interface ---

export interface GraphTraversalAnalysisProviderHandler {
  readonly initialize: (
    input: GraphTraversalAnalysisProviderInitializeInput,
    storage: GraphTraversalAnalysisProviderStorage,
  ) => TE.TaskEither<GraphTraversalAnalysisProviderError, GraphTraversalAnalysisProviderInitializeOutput>;
  readonly addEdge: (
    input: { readonly from: string; readonly to: string; readonly label: string },
    storage: GraphTraversalAnalysisProviderStorage,
  ) => TE.TaskEither<GraphTraversalAnalysisProviderError, { readonly edgeCount: number }>;
  readonly dfs: (
    input: { readonly start: string },
    storage: GraphTraversalAnalysisProviderStorage,
  ) => TE.TaskEither<GraphTraversalAnalysisProviderError, DfsResult>;
  readonly bfs: (
    input: { readonly start: string },
    storage: GraphTraversalAnalysisProviderStorage,
  ) => TE.TaskEither<GraphTraversalAnalysisProviderError, { readonly visited: readonly string[] }>;
  readonly dominatorTree: (
    input: { readonly root: string },
    storage: GraphTraversalAnalysisProviderStorage,
  ) => TE.TaskEither<GraphTraversalAnalysisProviderError, { readonly dominators: Record<string, string> }>;
  readonly stronglyConnectedComponents: (
    storage: GraphTraversalAnalysisProviderStorage,
  ) => TE.TaskEither<GraphTraversalAnalysisProviderError, { readonly components: readonly (readonly string[])[] }>;
}

// --- Implementation ---

export const graphTraversalAnalysisProviderHandler: GraphTraversalAnalysisProviderHandler = {
  // Verify storage and load existing graph edges.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const edges = await storage.find('graph_edges');
          await storage.put('graph_instances', instanceId, {
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

  // Add a directed edge to the graph.
  addEdge: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const edgeId = `${input.from}->${input.to}`;
          await storage.put('graph_edges', edgeId, {
            from: input.from,
            to: input.to,
            label: input.label,
            id: edgeId,
            createdAt: nowISO(),
          });
          // Ensure nodes are registered
          await storage.put('graph_nodes', input.from, { name: input.from });
          await storage.put('graph_nodes', input.to, { name: input.to });
          const allEdges = await storage.find('graph_edges');
          return { edgeCount: allEdges.length };
        },
        storageError,
      ),
    ),

  // Perform depth-first search from a start node, returning traversal data.
  dfs: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('graph_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly GraphEdge[] = records.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          label: String(r['label'] ?? ''),
        }));
        const adj = buildAdj(edges);
        return dfs(input.start, adj);
      }),
    ),

  // Perform breadth-first search from a start node.
  bfs: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('graph_edges'),
        storageError,
      ),
      TE.map((records) => {
        const edges: readonly GraphEdge[] = records.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          label: String(r['label'] ?? ''),
        }));
        const adj = buildAdj(edges);
        return { visited: bfs(input.start, adj) };
      }),
    ),

  // Compute the dominator tree rooted at the given node.
  dominatorTree: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const edgeRecords = await storage.find('graph_edges');
          const nodeRecords = await storage.find('graph_nodes');
          return { edgeRecords, nodeRecords };
        },
        storageError,
      ),
      TE.map(({ edgeRecords, nodeRecords }) => {
        const edges: readonly GraphEdge[] = edgeRecords.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          label: String(r['label'] ?? ''),
        }));
        const nodes = nodeRecords.map((r) => String(r['name'] ?? ''));
        const adj = buildAdj(edges);
        const reverseAdj = buildReverseAdj(edges);
        const doms = computeDominators(input.root, nodes, adj, reverseAdj);
        const result: Record<string, string> = {};
        doms.forEach((v, k) => { result[k] = v; });
        return { dominators: result };
      }),
    ),

  // Find all strongly connected components using Tarjan's algorithm.
  stronglyConnectedComponents: (storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const edgeRecords = await storage.find('graph_edges');
          const nodeRecords = await storage.find('graph_nodes');
          return { edgeRecords, nodeRecords };
        },
        storageError,
      ),
      TE.map(({ edgeRecords, nodeRecords }) => {
        const edges: readonly GraphEdge[] = edgeRecords.map((r) => ({
          from: String(r['from'] ?? ''),
          to: String(r['to'] ?? ''),
          label: String(r['label'] ?? ''),
        }));
        const nodes = nodeRecords.map((r) => String(r['name'] ?? ''));
        const adj = buildAdj(edges);
        return { components: tarjanScc(nodes, adj) };
      }),
    ),
};
