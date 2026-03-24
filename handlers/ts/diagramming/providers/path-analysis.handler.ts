// @clef-handler style=functional concept=PathAnalysisProvider
// ============================================================
// PathAnalysisProvider Handler
//
// Finds paths between nodes using shortest path (Dijkstra/BFS),
// all simple paths (DFS with backtracking), or critical path
// (longest path in DAG) algorithms.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_ALGORITHMS = new Set(['shortest-path', 'all-paths', 'critical-path']);

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'PathAnalysisProvider',
      category: 'path',
    }) as StorageProgram<Result>;
  },

  analyze(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const algorithm = input.algorithm as string;
    const config = (input.config as Record<string, unknown>) || {};

    if (!graph || graph.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'graph is required' }) as StorageProgram<Result>;
    }
    if (!algorithm || algorithm.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'algorithm is required' }) as StorageProgram<Result>;
    }
    if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
      const p = createProgram();
      return complete(p, 'error', {
        message: `Unknown algorithm "${algorithm}". Supported: ${[...SUPPORTED_ALGORITHMS].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const source = config.source as string | undefined;
    const target = config.target as string | undefined;

    // all-paths requires both source and target
    if (algorithm === 'all-paths' && (!source || !target)) {
      const p = createProgram();
      return complete(p, 'error', {
        message: 'all-paths algorithm requires both source and target nodes',
      }) as StorageProgram<Result>;
    }

    // shortest-path requires source
    if (algorithm === 'shortest-path' && !source) {
      const p = createProgram();
      return complete(p, 'error', {
        message: 'shortest-path algorithm requires a source node',
      }) as StorageProgram<Result>;
    }

    // Mock path analysis results.
    // In production, delegates to a graph computation engine via perform().
    // - shortest-path: Dijkstra O((V+E) log V) or BFS O(V+E)
    // - all-paths: DFS with backtracking, bounded by max_paths
    // - critical-path: Topological sort O(V+E), errors on cyclic graphs
    const mockPath = {
      nodes: [source ?? 'node-1', 'node-mid', target ?? 'node-n'],
      edges: ['edge-1', 'edge-2'],
      cost: 5.0,
    };

    const payload = JSON.stringify({
      algorithm,
      paths: [mockPath],
      stats: {
        pathCount: 1,
        minCost: 5.0,
        maxCost: 5.0,
      },
    });

    const p = createProgram();
    return complete(p, 'ok', { payload }) as StorageProgram<Result>;
  },
};

export const pathAnalysisHandler = autoInterpret(_handler);

export default pathAnalysisHandler;
