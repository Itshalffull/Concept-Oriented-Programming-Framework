// @migrated dsl-constructs 2026-03-18
// Reputation Concept Handler
// Coordination concept routing to pluggable reputation algorithm providers.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _reputationHandler: FunctionalConceptHandler = {
  earn(input: Record<string, unknown>) {
    const { participant, amount, reason } = input;
    const id = `rep-${participant}`;
    let p = createProgram();
    p = get(p, 'reputation', id, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? { score: 0, history: [] };
      const newScore = (record.score as number) + (amount as number);
      const history = (record.history as unknown[]) ?? [];
      history.push({ amount, reason, earnedAt: new Date().toISOString() });
      return { newScore, history };
    }, 'computed');

    p = put(p, 'reputation', id, { id, participant, score: 0, history: [] });

    return completeFrom(p, 'earned', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { entry: id, newScore: computed.newScore };
    }) as StorageProgram<Result>;
  },

  burn(input: Record<string, unknown>) {
    const { participant, amount } = input;
    const id = `rep-${participant}`;
    let p = createProgram();
    p = get(p, 'reputation', id, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? { score: 0, history: [] };
      return Math.max(0, (record.score as number) - (amount as number));
    }, 'newScore');

    p = put(p, 'reputation', id, { score: 0 });

    return completeFrom(p, 'burned', (bindings) => {
      return { entry: id, newScore: bindings.newScore };
    }) as StorageProgram<Result>;
  },

  decay(input: Record<string, unknown>) {
    const { participant, decayFactor } = input;
    const id = `rep-${participant}`;
    let p = createProgram();
    p = get(p, 'reputation', id, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? { score: 0 };
      return (record.score as number) * (1 - (decayFactor as number));
    }, 'newScore');

    p = put(p, 'reputation', id, { score: 0 });

    return completeFrom(p, 'decayed', (bindings) => {
      return { entry: id, newScore: bindings.newScore };
    }) as StorageProgram<Result>;
  },

  getScore(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    p = get(p, 'reputation', `rep-${participant}`, 'record');

    return completeFrom(p, 'score', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      if (!record) return { participant, score: 0.0 };
      return { participant, score: record.score };
    }) as StorageProgram<Result>;
  },

  recalculate(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    return complete(p, 'recalculated', { participant, newScore: 0.0 }) as StorageProgram<Result>;
  },
};

export const reputationHandler = autoInterpret(_reputationHandler);
