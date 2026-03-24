// @clef-handler style=functional concept=FlowAnalysisProvider
// ============================================================
// FlowAnalysisProvider Handler
//
// Computes network flow properties including maximum flow and
// minimum cut. Determines capacity bottlenecks and minimal edge
// sets that disconnect source from sink in weighted directed graphs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const SUPPORTED_ALGORITHMS = new Set(['max-flow', 'min-cut']);

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'FlowAnalysisProvider',
      category: 'flow',
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
    const sink = config.sink as string | undefined;

    if (!source || !sink) {
      const p = createProgram();
      return complete(p, 'error', {
        message: 'source and sink nodes are required for flow analysis',
      }) as StorageProgram<Result>;
    }

    // Mock flow analysis results.
    // In production, delegates to a graph computation engine via perform()
    // implementing Edmonds-Karp (BFS Ford-Fulkerson). O(V*E^2).
    let payload: string;

    if (algorithm === 'max-flow') {
      payload = JSON.stringify({
        algorithm,
        value: 15,
        edgeFlows: [
          { source, target: 'node-mid', flow: 10, capacity: 10 },
          { source: 'node-mid', target: sink, flow: 15, capacity: 20 },
        ],
      });
    } else {
      // min-cut
      payload = JSON.stringify({
        algorithm,
        value: 15,
        cutEdges: [
          { source, target: 'node-mid' },
        ],
        sourcePartition: [source, 'node-a'],
        sinkPartition: [sink, 'node-b'],
      });
    }

    const p = createProgram();
    return complete(p, 'ok', { payload }) as StorageProgram<Result>;
  },
};

export const flowAnalysisHandler = autoInterpret(_handler);

export default flowAnalysisHandler;
