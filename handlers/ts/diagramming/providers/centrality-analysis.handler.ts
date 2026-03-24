// @clef-handler style=functional concept=CentralityAnalysisProvider
// ============================================================
// CentralityAnalysisProvider Handler
//
// Computes node importance scores using degree, betweenness,
// closeness, eigenvector, or PageRank centrality measures.
// Produces normalized score per node for ranking and visual scaling.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_ALGORITHMS = new Set(['degree', 'betweenness', 'closeness', 'eigenvector', 'pagerank']);

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'CentralityAnalysisProvider',
      category: 'centrality',
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

    // Compute mock centrality scores based on algorithm type.
    // In production, this delegates to a graph computation engine via perform().
    const damping = config.damping != null ? parseFloat(config.damping as string) : 0.85;
    const iterations = config.iterations != null ? (config.iterations as number) : 100;

    const mockScores = [
      { nodeId: 'node-1', score: 0.85, rank: 1 },
      { nodeId: 'node-2', score: 0.62, rank: 2 },
      { nodeId: 'node-3', score: 0.41, rank: 3 },
    ];

    const payload = JSON.stringify({
      algorithm,
      config: { damping, iterations },
      scores: mockScores,
    });

    const p = createProgram();
    return complete(p, 'ok', { payload }) as StorageProgram<Result>;
  },
};

export const centralityAnalysisHandler = autoInterpret(_handler);

export default centralityAnalysisHandler;
