// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SpatialLayout Handler
//
// Automatic layout algorithms for canvas elements. Layout
// providers are registered with named algorithms, and apply
// dispatches to the registered provider.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Built-in layout algorithms that don't require explicit registration
const BUILTIN_ALGORITHMS: Record<string, string> = {
  'force-directed': 'built-in',
  'hierarchical': 'built-in',
  'grid': 'built-in',
  'circular': 'built-in',
  'radial': 'built-in',
  'tree': 'built-in',
  'dagre': 'built-in',
  'elk': 'built-in',
  'random': 'built-in',
};

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const algorithm = input.algorithm as string;
    const provider = input.provider as string;

    if (!algorithm || algorithm.trim() === '') {
      return complete(createProgram(), 'unknown_algorithm', { message: 'algorithm name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'layout_algorithm', algorithm, {
      algorithm,
      provider,
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    if (!input.algorithm || (typeof input.algorithm === 'string' && (input.algorithm as string).trim() === '')) {
      return complete(createProgram(), 'unknown_algorithm', { message: 'algorithm is required' }) as StorageProgram<Result>;
    }
    const algorithm = input.algorithm as string;

    // Check built-in algorithms first
    if (BUILTIN_ALGORITHMS[algorithm]) {
      return complete(createProgram(), 'ok', { provider: BUILTIN_ALGORITHMS[algorithm] }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layout_algorithm', algorithm, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { provider: record.provider };
        });
      },
      (elseP) => complete(elseP, 'unknown_algorithm', { message: `Algorithm '${algorithm}' is not registered` }),
    ) as StorageProgram<Result>;
  },
};

export const spatialLayoutHandler = autoInterpret(_handler);

export default spatialLayoutHandler;
