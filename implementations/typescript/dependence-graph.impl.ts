// ============================================================
// DependenceGraph Handler
//
// Data and control dependency edges between program elements,
// within and across files. Enables forward and backward slicing,
// impact analysis, and dependency queries at file, module, or
// project scope.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
 * Build an adjacency list from stored edges for a given graph ID.
 */
async function loadAdjacency(
  graphId: string,
  storage: ConceptStorage,
): Promise<{ nodes: Set<string>; adj: Map<string, Edge[]>; reverseAdj: Map<string, Edge[]> }> {
  const edges = await storage.find('dependence-graph-edge', { graphId });
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

export const dependenceGraphHandler: ConceptHandler = {
  async compute(input: Record<string, unknown>, storage: ConceptStorage) {
    const scopeRef = input.scopeRef as string;

    const scope = inferScope(scopeRef);
    const id = nextId();

    // Initialize graph metadata with empty nodes/edges
    await storage.put('dependence-graph', id, {
      id,
      scope,
      scopeRef,
      nodes: '[]',
      edges: '[]',
      nodeCount: 0,
      edgeCount: 0,
    });

    return { variant: 'ok', graph: id };
  },

  async queryDependents(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const edgeKinds = input.edgeKinds as string;

    const edgeFilter = parseEdgeKinds(edgeKinds);

    // Find all graphs and collect dependents across them
    const graphs = await storage.find('dependence-graph', {});
    const allDependents: { symbol: string; edgeKind: string; graphId: string }[] = [];

    for (const graph of graphs) {
      const graphId = graph.id as string;
      const { reverseAdj } = await loadAdjacency(graphId, storage);

      // Edge A -> B means "A depends on B". queryDependents(symbol) finds
      // all nodes that depend on symbol, i.e., edges where edge.to === symbol.
      // reverseAdj.get(symbol) yields those edges; each edge.from is a dependent.
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

    return { variant: 'ok', dependents: JSON.stringify(allDependents) };
  },

  async queryDependencies(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const edgeKinds = input.edgeKinds as string;

    const edgeFilter = parseEdgeKinds(edgeKinds);

    // queryDependencies(symbol) = "all symbols that symbol depends on"
    // = all nodes B where there's an edge symbol -> B
    // = adj.get(symbol), each edge.to is a dependency
    const graphs = await storage.find('dependence-graph', {});
    const allDependencies: { symbol: string; edgeKind: string; graphId: string }[] = [];

    for (const graph of graphs) {
      const graphId = graph.id as string;
      const { adj } = await loadAdjacency(graphId, storage);

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

    return { variant: 'ok', dependencies: JSON.stringify(allDependencies) };
  },

  async sliceForward(input: Record<string, unknown>, storage: ConceptStorage) {
    const criterion = input.criterion as string;

    // Forward slice: all symbols affected by changes to the criterion.
    // Edge A -> B means "A depends on B". Forward slice of criterion =
    // all nodes that transitively depend on criterion. We walk reverseAdj
    // from criterion: reverseAdj[N] gives nodes depending on N.
    const graphs = await storage.find('dependence-graph', {});
    const sliceNodes = new Set<string>();
    const sliceEdges: Edge[] = [];

    for (const graph of graphs) {
      const graphId = graph.id as string;
      const { reverseAdj } = await loadAdjacency(graphId, storage);
      const { reachable, traversedEdges } = transitiveBackward([criterion], reverseAdj);
      for (const n of reachable) sliceNodes.add(n);
      sliceEdges.push(...traversedEdges);
    }

    return {
      variant: 'ok',
      slice: JSON.stringify([...sliceNodes]),
      edges: JSON.stringify(sliceEdges),
    };
  },

  async sliceBackward(input: Record<string, unknown>, storage: ConceptStorage) {
    const criterion = input.criterion as string;

    // Backward slice: all symbols that contribute to the criterion.
    // = all things criterion transitively depends on
    // = walk forward from criterion in adj (adj[criterion] = what criterion depends on)
    const graphs = await storage.find('dependence-graph', {});
    const sliceNodes = new Set<string>();
    const sliceEdges: Edge[] = [];

    for (const graph of graphs) {
      const graphId = graph.id as string;
      const { adj } = await loadAdjacency(graphId, storage);
      const { reachable, traversedEdges } = transitiveForward([criterion], adj);
      for (const n of reachable) sliceNodes.add(n);
      sliceEdges.push(...traversedEdges);
    }

    return {
      variant: 'ok',
      slice: JSON.stringify([...sliceNodes]),
      edges: JSON.stringify(sliceEdges),
    };
  },

  async impactAnalysis(input: Record<string, unknown>, storage: ConceptStorage) {
    const changed = input.changed as string;

    // Parse changed symbols (JSON array or comma-separated)
    let changedSymbols: string[];
    try {
      changedSymbols = JSON.parse(changed) as string[];
    } catch {
      changedSymbols = changed.split(',').map((s) => s.trim());
    }

    // Compute forward slice from all changed symbols
    const graphs = await storage.find('dependence-graph', {});
    const affectedNodes = new Set<string>();
    const allPaths: { from: string; to: string; kind: string }[] = [];

    for (const graph of graphs) {
      const graphId = graph.id as string;
      const { reverseAdj } = await loadAdjacency(graphId, storage);
      const { reachable, traversedEdges } = transitiveBackward(changedSymbols, reverseAdj);
      for (const n of reachable) affectedNodes.add(n);
      for (const edge of traversedEdges) {
        allPaths.push({ from: edge.from, to: edge.to, kind: edge.kind });
      }
    }

    // Remove the changed symbols themselves from the affected set
    for (const s of changedSymbols) {
      affectedNodes.delete(s);
    }

    return {
      variant: 'ok',
      affected: JSON.stringify([...affectedNodes]),
      paths: JSON.stringify(allPaths),
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const graph = input.graph as string;

    const record = await storage.get('dependence-graph', graph);
    if (!record) {
      return { variant: 'notfound' };
    }

    // Count actual edges for this graph
    const edges = await storage.find('dependence-graph-edge', { graphId: graph });
    const nodes = new Set<string>();
    for (const edge of edges) {
      nodes.add(edge.from as string);
      nodes.add(edge.to as string);
    }

    return {
      variant: 'ok',
      graph: record.id as string,
      scope: record.scope as string,
      nodeCount: nodes.size,
      edgeCount: edges.length,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDependenceGraphCounter(): void {
  idCounter = 0;
}
