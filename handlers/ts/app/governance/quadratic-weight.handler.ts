// @migrated dsl-constructs 2026-03-18
// QuadraticWeight Source Provider
// Applies square-root scaling to a base balance for diminishing-returns governance weight.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _quadraticWeightHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `qw-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'qw_cfg', id, {
      id,
      baseSource: input.baseSource,
    });
    p = put(p, 'plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'QuadraticWeight',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const { participant, balance } = input;
    const weight = Math.sqrt(balance as number);
    let p = createProgram();
    return complete(p, 'weight', { participant, balance, sqrtWeight: weight }) as StorageProgram<Result>;
  },
};

export const quadraticWeightHandler = autoInterpret(_quadraticWeightHandler);
