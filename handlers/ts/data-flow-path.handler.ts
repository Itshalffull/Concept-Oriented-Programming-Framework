// ============================================================
// DataFlowPath Handler
//
// Traced flow of data from source to sink through the program.
// Enables taint tracking, config value propagation tracing,
// and data provenance analysis.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `data-flow-path-${++idCounter}`;
}

/**
 * Infer the path kind based on source and sink symbol prefixes.
 */
function inferPathKind(source: string, sink: string): string {
  if (source.startsWith('config/')) return 'config-propagation';
  if (sink.endsWith('.output') || sink.includes('/output/')) return 'output-derivation';
  if (source.includes('user-input') || source.includes('request')) return 'taint';
  return 'data-flow';
}

/**
 * Walk stored dependence-graph edges to find all paths from source to sink.
 * Uses BFS over adjacency lists stored in the dependence-graph relation.
 */
async function findPaths(
  source: string,
  sink: string,
  storage: ConceptStorage,
): Promise<{ id: string; steps: string[]; pathKind: string }[]> {
  // Load all dependence graph edges
  const edges = await storage.find('dependence-graph-edge', {});

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const from = edge.from as string;
    const to = edge.to as string;
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
  }

  // BFS to find all paths from source to sink
  const paths: { id: string; steps: string[]; pathKind: string }[] = [];
  const queue: { node: string; path: string[] }[] = [{ node: source, path: [source] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.node === sink) {
      const pathId = nextId();
      paths.push({
        id: pathId,
        steps: current.path,
        pathKind: inferPathKind(source, sink),
      });
      continue;
    }

    const key = `${current.node}:${current.path.length}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const neighbors = adj.get(current.node) ?? [];
    for (const neighbor of neighbors) {
      if (!current.path.includes(neighbor)) {
        queue.push({ node: neighbor, path: [...current.path, neighbor] });
      }
    }
  }

  return paths;
}

export const dataFlowPathHandler: ConceptHandler = {
  async trace(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const sink = input.sink as string;

    const paths = await findPaths(source, sink, storage);

    if (paths.length === 0) {
      return { variant: 'noPath' };
    }

    // Store each discovered path
    for (const p of paths) {
      await storage.put('data-flow-path', p.id, {
        id: p.id,
        sourceSymbol: source,
        sinkSymbol: sink,
        steps: JSON.stringify(p.steps),
        pathKind: p.pathKind,
        stepCount: p.steps.length,
      });
    }

    return { variant: 'ok', paths: JSON.stringify(paths) };
  },

  async traceFromConfig(input: Record<string, unknown>, storage: ConceptStorage) {
    const configKey = input.configKey as string;

    // Find all edges originating from this config key
    const edges = await storage.find('dependence-graph-edge', { from: configKey });

    // For each direct sink, run a full path trace
    const allPaths: { id: string; steps: string[]; pathKind: string }[] = [];
    const sinks = new Set<string>();
    for (const edge of edges) {
      sinks.add(edge.to as string);
    }

    // Also look for config-prefixed sources
    const configSource = configKey.startsWith('config/') ? configKey : `config/${configKey}`;
    const configEdges = await storage.find('dependence-graph-edge', { from: configSource });
    for (const edge of configEdges) {
      sinks.add(edge.to as string);
    }

    // Collect all reachable nodes via BFS from config source
    const allEdges = await storage.find('dependence-graph-edge', {});
    const adj = new Map<string, string[]>();
    for (const edge of allEdges) {
      const from = edge.from as string;
      const to = edge.to as string;
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push(to);
    }

    const visited = new Set<string>();
    const queue = [configSource, configKey];
    const reachableLeaves: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adj.get(current) ?? [];
      if (neighbors.length === 0 && current !== configSource && current !== configKey) {
        reachableLeaves.push(current);
      }
      for (const n of neighbors) {
        queue.push(n);
      }
    }

    // Trace paths to each leaf
    for (const leaf of reachableLeaves) {
      const paths = await findPaths(configSource, leaf, storage);
      allPaths.push(...paths);
    }

    // If no leaf paths, trace to direct sinks
    if (allPaths.length === 0) {
      for (const sink of sinks) {
        const paths = await findPaths(configSource, sink, storage);
        allPaths.push(...paths);
      }
    }

    return { variant: 'ok', paths: JSON.stringify(allPaths) };
  },

  async traceToOutput(input: Record<string, unknown>, storage: ConceptStorage) {
    const output = input.output as string;

    // Find all edges leading to this output by walking backward
    const allEdges = await storage.find('dependence-graph-edge', {});
    const reverseAdj = new Map<string, string[]>();
    for (const edge of allEdges) {
      const from = edge.from as string;
      const to = edge.to as string;
      if (!reverseAdj.has(to)) reverseAdj.set(to, []);
      reverseAdj.get(to)!.push(from);
    }

    // BFS backward from output to find all sources
    const visited = new Set<string>();
    const queue = [output];
    const sources: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const predecessors = reverseAdj.get(current) ?? [];
      if (predecessors.length === 0 && current !== output) {
        sources.push(current);
      }
      for (const p of predecessors) {
        queue.push(p);
      }
    }

    // Trace paths from each source to the output
    const allPaths: { id: string; steps: string[]; pathKind: string }[] = [];
    for (const source of sources) {
      const paths = await findPaths(source, output, storage);
      allPaths.push(...paths);
    }

    return { variant: 'ok', paths: JSON.stringify(allPaths) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const path = input.path as string;

    const record = await storage.get('data-flow-path', path);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      path: record.id as string,
      sourceSymbol: record.sourceSymbol as string,
      sinkSymbol: record.sinkSymbol as string,
      pathKind: record.pathKind as string,
      stepCount: record.stepCount as number,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDataFlowPathCounter(): void {
  idCounter = 0;
}
