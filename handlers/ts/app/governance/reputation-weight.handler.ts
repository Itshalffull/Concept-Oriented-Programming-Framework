// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ReputationWeight Source Provider
// Applies scaling functions (linear, log, sigmoid) to raw reputation scores for weighted governance.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function applyScaling(score: number, fn: string, cap: number | null): number {
  let scaled: number;
  switch (fn) {
    case 'log':
      scaled = score > 0 ? Math.log(1 + score) : 0;
      break;
    case 'sigmoid':
      scaled = 1 / (1 + Math.exp(-score));
      break;
    case 'linear':
    default:
      scaled = score;
      break;
  }
  if (cap !== null && scaled > cap) scaled = cap;
  return scaled;
}

const _reputationWeightHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `rw-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'rw_cfg', id, {
      id,
      scalingFunction: input.scalingFunction ?? 'linear',
      cap: input.cap ?? null,
    });
    p = put(p, 'plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'ReputationWeight',
      instanceId: id,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const { config, participant, reputationScore } = input;
    let p = createProgram();
    p = get(p, 'rw_cfg', config as string, 'cfg');

    return completeFrom(p, 'weight', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const scalingFn = cfg ? (cfg.scalingFunction as string) : 'linear';
      const cap = cfg ? (cfg.cap as number | null) : null;
      const weight = applyScaling(reputationScore as number, scalingFn, cap);
      return { participant, weight, rawScore: reputationScore };
    }) as StorageProgram<Result>;
  },
};

export const reputationWeightHandler = autoInterpret(_reputationWeightHandler);
