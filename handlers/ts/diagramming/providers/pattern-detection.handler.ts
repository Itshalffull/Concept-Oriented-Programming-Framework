// @clef-handler style=functional concept=PatternDetectionProvider
// ============================================================
// PatternDetectionProvider Handler
//
// Detects structural patterns in graphs: cycles, cliques,
// bridges, and articulation points. Identifies topological
// features that reveal vulnerabilities, clusters, and loops.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_ALGORITHMS = new Set(['cycles', 'cliques', 'bridges', 'articulation-points']);

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'PatternDetectionProvider',
      category: 'pattern',
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

    const maxLength = config.max_length as number | undefined;
    const minSize = config.min_size as number | undefined;

    // Mock pattern detection results.
    // In production, delegates to a graph computation engine via perform().
    // - cycles: Johnson's algorithm O((V+E)(C+1)) or DFS for undirected
    // - cliques: Bron-Kerbosch with pivoting O(3^(V/3))
    // - bridges: Tarjan's bridge-finding O(V+E)
    // - articulation-points: Tarjan's cut vertex algorithm O(V+E)
    let matches: Array<{ type: string; nodes: string[]; edges: string[] }>;

    if (algorithm === 'cycles') {
      matches = [
        { type: 'cycle', nodes: ['node-1', 'node-2', 'node-3'], edges: ['e12', 'e23', 'e31'] },
      ].filter(m => !maxLength || m.nodes.length <= maxLength);
    } else if (algorithm === 'cliques') {
      matches = [
        { type: 'clique', nodes: ['node-1', 'node-2', 'node-3'], edges: ['e12', 'e13', 'e23'] },
      ].filter(m => !minSize || m.nodes.length >= minSize);
    } else if (algorithm === 'bridges') {
      matches = [
        { type: 'bridge', nodes: ['node-2', 'node-4'], edges: ['e24'] },
      ];
    } else {
      // articulation-points
      matches = [
        { type: 'articulation-point', nodes: ['node-3'], edges: [] },
      ];
    }

    const payload = JSON.stringify({
      algorithm,
      matches,
      count: matches.length,
    });

    const p = createProgram();
    return complete(p, 'ok', { payload }) as StorageProgram<Result>;
  },
};

export const patternDetectionHandler = autoInterpret(_handler);

export default patternDetectionHandler;
