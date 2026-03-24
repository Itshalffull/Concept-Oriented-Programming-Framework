// @clef-handler style=functional concept=StructuralAnalysisProvider
// ============================================================
// StructuralAnalysisProvider Handler
//
// Decomposes graphs into structural components: connected
// components, strongly connected components, and k-cores.
// Reveals fundamental connectivity structure and cohesion.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_ALGORITHMS = new Set(['connected-components', 'strongly-connected', 'k-core']);

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'StructuralAnalysisProvider',
      category: 'structural',
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

    const k = config.k as number | undefined;

    // Mock structural decomposition results.
    // In production, delegates to a graph computation engine via perform().
    // - connected-components: Union-Find or BFS/DFS O(V+E)
    // - strongly-connected: Tarjan's or Kosaraju's O(V+E)
    // - k-core: Iterative degree pruning O(V+E)
    let components: Array<{ id: string; nodes: string[]; size: number }>;

    if (algorithm === 'connected-components') {
      components = [
        { id: 'cc-0', nodes: ['node-1', 'node-2', 'node-3'], size: 3 },
        { id: 'cc-1', nodes: ['node-4', 'node-5'], size: 2 },
      ];
    } else if (algorithm === 'strongly-connected') {
      components = [
        { id: 'scc-0', nodes: ['node-1', 'node-2'], size: 2 },
        { id: 'scc-1', nodes: ['node-3'], size: 1 },
        { id: 'scc-2', nodes: ['node-4', 'node-5'], size: 2 },
      ];
    } else {
      // k-core: return maximal subgraph where every node has degree >= k
      const kValue = k ?? 2;
      components = [
        { id: `k${kValue}-core-0`, nodes: ['node-1', 'node-2', 'node-3'], size: 3 },
      ];
    }

    const payload = JSON.stringify({
      algorithm,
      config: k != null ? { k } : {},
      components,
      componentCount: components.length,
    });

    const p = createProgram();
    return complete(p, 'ok', { payload }) as StorageProgram<Result>;
  },
};

export const structuralAnalysisHandler = autoInterpret(_handler);

export default structuralAnalysisHandler;
