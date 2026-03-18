// @migrated dsl-constructs 2026-03-18
// ============================================================
// DataFlowPath Handler
//
// Traced flow of data from source to sink through the program.
// Enables taint tracking, config value propagation tracing,
// and data provenance analysis.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

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
 * Pure computation over pre-loaded edges.
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

const _handler: FunctionalConceptHandler = {
  trace(input: Record<string, unknown>) {
    const source = input.source as string;
    const sink = input.sink as string;

    let p = createProgram();
    p = find(p, 'dependence-graph-edge', {}, 'edges');

    p = mapBindings(p, (bindings) => {
      const edges = bindings.edges as Record<string, unknown>[];
      return findPathsFromEdges(source, sink, edges);
    }, 'paths');

    return branch(p,
      (bindings) => (bindings.paths as unknown[]).length === 0,
      (thenP) => complete(thenP, 'noPath', {}),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => ({
        paths: JSON.stringify(bindings.paths),
      })),
    ) as StorageProgram<Result>;
  },

  traceFromConfig(input: Record<string, unknown>) {
    const configKey = input.configKey as string;

    let p = createProgram();
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const allEdges = bindings.allEdges as Record<string, unknown>[];

      const configSource = configKey.startsWith('config/') ? configKey : `config/${configKey}`;

      // Build adjacency list
      const adj = new Map<string, string[]>();
      for (const edge of allEdges) {
        const from = edge.from as string;
        const to = edge.to as string;
        if (!adj.has(from)) adj.set(from, []);
        adj.get(from)!.push(to);
      }

      // BFS to find reachable leaves
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
      const allPaths: { id: string; steps: string[]; pathKind: string }[] = [];
      for (const leaf of reachableLeaves) {
        const paths = findPathsFromEdges(configSource, leaf, allEdges);
        allPaths.push(...paths);
      }

      return { paths: JSON.stringify(allPaths) };
    }) as StorageProgram<Result>;
  },

  traceToOutput(input: Record<string, unknown>) {
    const output = input.output as string;

    let p = createProgram();
    p = find(p, 'dependence-graph-edge', {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const allEdges = bindings.allEdges as Record<string, unknown>[];

      // Build reverse adjacency list
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
        const paths = findPathsFromEdges(source, output, allEdges);
        allPaths.push(...paths);
      }

      return { paths: JSON.stringify(allPaths) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = get(p, 'data-flow-path', path, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          path: record.id as string,
          sourceSymbol: record.sourceSymbol as string,
          sinkSymbol: record.sinkSymbol as string,
          pathKind: record.pathKind as string,
          stepCount: record.stepCount as number,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const dataFlowPathHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetDataFlowPathCounter(): void {
  idCounter = 0;
}
