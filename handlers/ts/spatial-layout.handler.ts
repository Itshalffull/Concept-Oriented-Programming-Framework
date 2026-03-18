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

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const algorithm = input.algorithm as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = put(p, 'layout_algorithm', algorithm, {
      algorithm,
      provider,
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const algorithm = input.algorithm as string;

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
