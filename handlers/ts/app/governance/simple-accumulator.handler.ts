// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// SimpleAccumulator Reputation Provider
// Add/subtract reputation with optional per-period decay and configurable cap.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _simpleAccumulatorHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `acc-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'accumulator', id, {
      id,
      decayRate: input.decayRate ?? null,
      cap: input.cap ?? null,
    });
    p = put(p, 'plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'SimpleAccumulator',
      instanceId: id,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  add(input: Record<string, unknown>) {
    const { config, participant, amount } = input;
    const key = `${config}:${participant}`;
    let p = createProgram();
    p = get(p, 'accumulator', config as string, 'cfg');
    p = get(p, 'acc_score', key, 'existing');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const cap = cfg ? (cfg.cap as number | null) : null;
      const existing = bindings.existing as Record<string, unknown> | null;
      const currentScore = existing ? (existing.score as number) : 0;
      let newScore = currentScore + (amount as number);
      if (cap !== null) newScore = Math.min(newScore, cap);
      return newScore;
    }, 'newScore');

    p = putFrom(p, 'acc_score', key, (bindings) => ({
      config, participant, score: bindings.newScore as number,
      updatedAt: new Date().toISOString(),
    }));

    return completeFrom(p, 'added', (bindings) => {
      return { participant, newScore: bindings.newScore };
    }) as StorageProgram<Result>;
  },

  applyDecay(input: Record<string, unknown>) {
    const { config, participant } = input;
    const key = `${config}:${participant}`;
    let p = createProgram();
    p = get(p, 'accumulator', config as string, 'cfg');

    p = branch(p,
      (bindings) => {
        const cfg = bindings.cfg as Record<string, unknown> | null;
        return cfg ? (cfg.decayRate as number | null) === null : true;
      },
      (b) => complete(b, 'no_decay', { participant }),
      (b) => {
        b = get(b, 'acc_score', key, 'existing');
        b = mapBindings(b, (bindings) => {
          const cfg = bindings.cfg as Record<string, unknown>;
          const decayRate = cfg.decayRate as number;
          const existing = bindings.existing as Record<string, unknown> | null;
          const currentScore = existing ? (existing.score as number) : 0;
          return { newScore: currentScore * (1 - decayRate), previousScore: currentScore };
        }, 'decayResult');

        let b2 = putFrom(b, 'acc_score', key, (bindings) => ({
          config, participant, score: (bindings.decayResult as Record<string, unknown>).newScore as number,
          updatedAt: new Date().toISOString(),
        }));

        return completeFrom(b2, 'decayed', (bindings) => {
          const result = bindings.decayResult as Record<string, unknown>;
          return { participant, newScore: result.newScore, previousScore: result.previousScore };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  getScore(input: Record<string, unknown>) {
    if (!input.participant || (typeof input.participant === 'string' && (input.participant as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }
    const { config, participant } = input;
    const key = `${config}:${participant}`;
    let p = createProgram();
    p = get(p, 'acc_score', key, 'existing');

    return completeFrom(p, 'score', (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const score = existing ? (existing.score as number) : 0;
      return { participant, score };
    }) as StorageProgram<Result>;
  },
};

export const simpleAccumulatorHandler = autoInterpret(_simpleAccumulatorHandler);
