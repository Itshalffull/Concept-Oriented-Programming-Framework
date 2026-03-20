// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DataFlowPath Handler
//
// Traced flow of data from source to sink through the program.
// Enables taint tracking, config value propagation tracing,
// and data provenance analysis.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

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
 * Find all paths from source to sink using BFS over adjacency lists.
 */
function findPathsFromEdges(
  source: string,
  sink: string,
  edges: Record<string, unknown>[],
): { id: string; steps: string[]; pathKind: string }[] {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const from = edge.from as string;
    const to = edge.to as string;
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
  }

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
  async trace(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const source = input.source as string;
    const sink = input.sink as string;

    const edges = await storage.find('dependence-graph-edge', {});
    const paths = findPathsFromEdges(source, sink, edges);

    if (paths.length === 0) return { variant: 'noPath' };

    // Store discovered paths so they can be retrieved via get
    for (const path of paths) {
      await storage.put('data-flow-path', path.id, {
        id: path.id,
        sourceSymbol: source,
        sinkSymbol: sink,
        pathKind: path.pathKind,
        stepCount: path.steps.length,
        steps: JSON.stringify(path.steps),
      });
    }

    return { variant: 'ok', paths: JSON.stringify(paths) };
  },

  async traceFromConfig(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const configKey = input.configKey as string;
    const allEdges = await storage.find('dependence-graph-edge', {});
    const configSource = configKey.startsWith('config/') ? configKey : `config/${configKey}`;

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

    const allPaths: { id: string; steps: string[]; pathKind: string }[] = [];
    for (const leaf of reachableLeaves) {
      const paths = findPathsFromEdges(configSource, leaf, allEdges);
      allPaths.push(...paths);
    }

    return { variant: 'ok', paths: JSON.stringify(allPaths) };
  },

  async traceToOutput(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const output = input.output as string;
    const allEdges = await storage.find('dependence-graph-edge', {});

    const reverseAdj = new Map<string, string[]>();
    for (const edge of allEdges) {
      const from = edge.from as string;
      const to = edge.to as string;
      if (!reverseAdj.has(to)) reverseAdj.set(to, []);
      reverseAdj.get(to)!.push(from);
    }

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

    const allPaths: { id: string; steps: string[]; pathKind: string }[] = [];
    for (const source of sources) {
      const paths = findPathsFromEdges(source, output, allEdges);
      allPaths.push(...paths);
    }

    return { variant: 'ok', paths: JSON.stringify(allPaths) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const path = input.path as string;
    const record = await storage.get('data-flow-path', path);
    if (!record) return { variant: 'notfound' };
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
