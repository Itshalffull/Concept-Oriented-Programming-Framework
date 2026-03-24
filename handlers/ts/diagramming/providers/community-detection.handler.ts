// @clef-handler style=functional concept=CommunityDetectionProvider
// ============================================================
// CommunityDetectionProvider Handler
//
// Partitions graph nodes into communities using Louvain modularity
// optimization, label propagation, or direct modularity scoring.
// Produces non-overlapping community assignments.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_ALGORITHMS = new Set(['louvain', 'label-propagation', 'modularity']);

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'CommunityDetectionProvider',
      category: 'community',
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

    const resolution = config.resolution != null ? parseFloat(config.resolution as string) : 1.0;

    // Mock community detection results.
    // In production, delegates to a graph computation engine via perform().
    const payload = JSON.stringify({
      algorithm,
      config: { resolution },
      communities: [
        { communityId: 'c0', nodes: ['node-1', 'node-2'], size: 2 },
        { communityId: 'c1', nodes: ['node-3', 'node-4', 'node-5'], size: 3 },
      ],
      modularity: 0.42,
    });

    const p = createProgram();
    return complete(p, 'ok', { payload }) as StorageProgram<Result>;
  },
};

export const communityDetectionHandler = autoInterpret(_handler);

export default communityDetectionHandler;
