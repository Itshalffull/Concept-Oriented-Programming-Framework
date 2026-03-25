// @clef-handler style=functional
// ReputationWeight Source Provider
// Applies scaling functions (linear, log, sigmoid) to raw reputation scores for weighted governance.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom,
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

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ReputationWeight' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    // Require at least one meaningful configuration field
    if (!input.reputationSource && !input.decayRate && !input.scalingFunction && input.cap === undefined) {
      return complete(createProgram(), 'error', { message: 'configuration required' }) as StorageProgram<Result>;
    }
    const id = `rw-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'rw_cfg', id, {
      id,
      scalingFunction: input.scalingFunction ?? 'linear',
      cap: input.cap ?? null,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const { config, participant, reputationScore } = input;
    const score = typeof reputationScore === 'string' ? parseFloat(reputationScore as string) : (reputationScore as number);
    if (score !== undefined && !isNaN(score) && score < 0) {
      return complete(createProgram(), 'error', { message: 'reputationScore must be non-negative' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'rw_cfg', config as string, 'cfg');

    return completeFrom(p, 'ok', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const scalingFn = cfg ? (cfg.scalingFunction as string) : 'linear';
      const cap = cfg ? (typeof cfg.cap === 'string' ? parseFloat(cfg.cap as string) : cfg.cap as number | null) : null;
      const weight = applyScaling(score ?? 0, scalingFn, cap);
      return { participant, weight, rawScore: reputationScore };
    }) as StorageProgram<Result>;
  },
};

export const reputationWeightHandler = autoInterpret(_handler);
