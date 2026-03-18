// @migrated dsl-constructs 2026-03-18
// ============================================================
// DependenceGraph Handler
//
// Data and control dependency edges between program elements,
// within and across files. Enables forward and backward slicing,
// impact analysis, and dependency queries at file, module, or
// project scope.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `dependence-graph-${++idCounter}`;
}

/** Edge kinds recognized by the dependence graph. */
type EdgeKind = 'data-dep' | 'control-dep' | 'call' | 'import' | 'type-dep';

interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

/**
 * Build adjacency lists from edge records.
 */
function buildAdjacency(edges: Record<string, unknown>[]): {
  nodes: Set<string>;
  adj: Map<string, Edge[]>;
  reverseAdj: Map<string, Edge[]>;
} {
  const nodes = new Set<string>();
  const adj = new Map<string, Edge[]>();
  const reverseAdj = new Map<string, Edge[]>();

  for (const record of edges) {
    const from = record.from as string;
    const to = record.to as string;
    const kind = record.kind as EdgeKind;
    const edge: Edge = { from, to, kind };

    nodes.add(from);
    nodes.add(to);

    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(edge);

    if (!reverseAdj.has(to)) reverseAdj.set(to, []);
    reverseAdj.get(to)!.push(edge);
  }

  return { nodes, adj, reverseAdj };
}

/**
 * Compute transitive closure from a set of start nodes following edges forward.
 */
function transitiveForward(
  startNodes: string[],
  adj: Map<string, Edge[]>,
  edgeFilter?: Set<string>,
): { reachable: Set<string>; traversedEdges: Edge[] } {
  const reachable = new Set<string>();
  const traversedEdges: Edge[] = [];
  const queue = [...startNodes];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const outgoing = adj.get(current) ?? [];
    for (const edge of outgoing) {
      if (edgeFilter && !edgeFilter.has(edge.kind)) continue;
      traversedEdges.push(edge);
      if (!reachable.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return { reachable, traversedEdges };
}

/**
 * Compute transitive closure from a set of start nodes following edges backward.
 */
function transitiveBackward(
  startNodes: string[],
  reverseAdj: Map<string, Edge[]>,
  edgeFilter?: Set<string>,
): { reachable: Set<string>; traversedEdges: Edge[] } {
  const reachable = new Set<string>();
  const traversedEdges: Edge[] = [];
  const queue = [...startNodes];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const incoming = reverseAdj.get(current) ?? [];
    for (const edge of incoming) {
      if (edgeFilter && !edgeFilter.has(edge.kind)) continue;
      traversedEdges.push(edge);
      if (!reachable.has(edge.from)) {
        queue.push(edge.from);
      }
    }
  }

  return { reachable, traversedEdges };
}

/**
 * Parse a comma-separated edge kinds string into a filter set.
 */
function parseEdgeKinds(edgeKinds: string): Set<string> | undefined {
  if (!edgeKinds || edgeKinds.trim() === '') return undefined;
  return new Set(edgeKinds.split(',').map((k) => k.trim()));
}

/**
 * Determine scope label from a scope reference string.
 */
function inferScope(scopeRef: string): string {
  if (scopeRef.includes('/') || scopeRef.endsWith('.ts') || scopeRef.endsWith('.tsx') || scopeRef.endsWith('.js')) {
    return 'file';
  }
  if (scopeRef.includes('::') || scopeRef.includes('.')) {
    return 'module';
  }
  return 'project';
}

const _handler: FunctionalConceptHandler = {
  compute(input: Record<string, unknown>) {
    const scopeRef = input.scopeRef as string;

    const scope = inferScope(scopeRef);
    const id = nextId();

    let p = createProgram();
    p = put(p, 'dependence-graph', id, {
      id,
      scope,
      scopeRef,
      nodes: '[]',
      edges: '[]',
      nodeCount: 0,
      edgeCount: 0,
    });

    return complete(p, 'ok', { graph: id }) as StorageProgram<Result>;
  },

  queryDependents(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const edgeKinds = input.edgeKinds as string;

    const edgeFilter = parseEdgeKinds(edgeKinds);

    let p = createProgram();
    p = find(p, 'dependence-graph', {}, 'graphs');
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const graphs = bindings.graphs as Record<string, unknown>[];
      const allEdges = bindings.allEdges as Record<string, unknown>[];
      const allDependents: { symbol: string; edgeKind: string; graphId: string }[] = [];

      for (const graph of graphs) {
        const graphId = graph.id as string;
        const graphEdges = allEdges.filter(e => e.graphId === graphId);
        const { reverseAdj } = buildAdjacency(graphEdges);

        const incoming = reverseAdj.get(symbol) ?? [];
        for (const edge of incoming) {
          if (edgeFilter && !edgeFilter.has(edge.kind)) continue;
          allDependents.push({
            symbol: edge.from,
            edgeKind: edge.kind,
            graphId,
          });
        }
      }

      return { dependents: JSON.stringify(allDependents) };
    }) as StorageProgram<Result>;
  },

  queryDependencies(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const edgeKinds = input.edgeKinds as string;

    const edgeFilter = parseEdgeKinds(edgeKinds);

    let p = createProgram();
    p = find(p, 'dependence-graph', {}, 'graphs');
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const graphs = bindings.graphs as Record<string, unknown>[];
      const allEdges = bindings.allEdges as Record<string, unknown>[];
      const allDependencies: { symbol: string; edgeKind: string; graphId: string }[] = [];

      for (const graph of graphs) {
        const graphId = graph.id as string;
        const graphEdges = allEdges.filter(e => e.graphId === graphId);
        const { adj } = buildAdjacency(graphEdges);

        const outgoing = adj.get(symbol) ?? [];
        for (const edge of outgoing) {
          if (edgeFilter && !edgeFilter.has(edge.kind)) continue;
          allDependencies.push({
            symbol: edge.to,
            edgeKind: edge.kind,
            graphId,
          });
        }
      }

      return { dependencies: JSON.stringify(allDependencies) };
    }) as StorageProgram<Result>;
  },

  sliceForward(input: Record<string, unknown>) {
    const criterion = input.criterion as string;

    let p = createProgram();
    p = find(p, 'dependence-graph', {}, 'graphs');
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const graphs = bindings.graphs as Record<string, unknown>[];
      const allEdges = bindings.allEdges as Record<string, unknown>[];
      const sliceNodes = new Set<string>();
      const sliceEdges: Edge[] = [];

      for (const graph of graphs) {
        const graphId = graph.id as string;
        const graphEdges = allEdges.filter(e => e.graphId === graphId);
        const { reverseAdj } = buildAdjacency(graphEdges);
        const { reachable, traversedEdges } = transitiveBackward([criterion], reverseAdj);
        for (const n of reachable) sliceNodes.add(n);
        sliceEdges.push(...traversedEdges);
      }

      return {
        slice: JSON.stringify([...sliceNodes]),
        edges: JSON.stringify(sliceEdges),
      };
    }) as StorageProgram<Result>;
  },

  sliceBackward(input: Record<string, unknown>) {
    const criterion = input.criterion as string;

    let p = createProgram();
    p = find(p, 'dependence-graph', {}, 'graphs');
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const graphs = bindings.graphs as Record<string, unknown>[];
      const allEdges = bindings.allEdges as Record<string, unknown>[];
      const sliceNodes = new Set<string>();
      const sliceEdges: Edge[] = [];

      for (const graph of graphs) {
        const graphId = graph.id as string;
        const graphEdges = allEdges.filter(e => e.graphId === graphId);
        const { adj } = buildAdjacency(graphEdges);
        const { reachable, traversedEdges } = transitiveForward([criterion], adj);
        for (const n of reachable) sliceNodes.add(n);
        sliceEdges.push(...traversedEdges);
      }

      return {
        slice: JSON.stringify([...sliceNodes]),
        edges: JSON.stringify(sliceEdges),
      };
    }) as StorageProgram<Result>;
  },

  impactAnalysis(input: Record<string, unknown>) {
    const changed = input.changed as string;

    let changedSymbols: string[];
    try {
      changedSymbols = JSON.parse(changed) as string[];
    } catch {
      changedSymbols = changed.split(',').map((s) => s.trim());
    }

    let p = createProgram();
    p = find(p, 'dependence-graph', {}, 'graphs');
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const graphs = bindings.graphs as Record<string, unknown>[];
      const allEdges = bindings.allEdges as Record<string, unknown>[];
      const affectedNodes = new Set<string>();
      const allPaths: { from: string; to: string; kind: string }[] = [];

      for (const graph of graphs) {
        const graphId = graph.id as string;
        const graphEdges = allEdges.filter(e => e.graphId === graphId);
        const { reverseAdj } = buildAdjacency(graphEdges);
        const { reachable, traversedEdges } = transitiveBackward(changedSymbols, reverseAdj);
        for (const n of reachable) affectedNodes.add(n);
        for (const edge of traversedEdges) {
          allPaths.push({ from: edge.from, to: edge.to, kind: edge.kind });
        }
      }

      for (const s of changedSymbols) {
        affectedNodes.delete(s);
      }

      return {
        affected: JSON.stringify([...affectedNodes]),
        paths: JSON.stringify(allPaths),
      };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const graph = input.graph as string;

    let p = createProgram();
    p = get(p, 'dependence-graph', graph, 'record');
    p = find(p, 'dependence-graph-edge', { graphId: graph }, 'edges');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const edges = bindings.edges as Record<string, unknown>[];
        const nodes = new Set<string>();
        for (const edge of edges) {
          nodes.add(edge.from as string);
          nodes.add(edge.to as string);
        }

        return {
          graph: record.id as string,
          scope: record.scope as string,
          nodeCount: nodes.size,
          edgeCount: edges.length,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const dependenceGraphHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetDependenceGraphCounter(): void {
  idCounter = 0;
}
