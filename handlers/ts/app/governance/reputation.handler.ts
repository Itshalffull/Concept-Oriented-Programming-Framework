// @clef-handler style=functional
// Reputation Concept Handler
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _reputationHandler: FunctionalConceptHandler = {
  earn(input: Record<string, unknown>) {
    const participant = input.participant as string;
    const reason = input.reason;
    const amount = parseFloat(input.amount as string);

    if (!participant || participant.trim() === '') {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }
    if (!isNaN(amount) && amount <= 0) {
      return complete(createProgram(), 'error', { message: 'amount must be positive' }) as StorageProgram<Result>;
    }

    const id = `rep-${participant}`;
    let p = createProgram();
    p = get(p, 'reputation', id, '_existing');
    p = mapBindings(p, (b) => {
      const record = b._existing as Record<string, unknown> | null;
      const currentScore = record ? (record.score as number) : 0;
      const history = record ? ((record.history as unknown[]) ?? []) : [];
      const newScore = currentScore + (isNaN(amount) ? 0 : amount);
      const newHistory = [...history, { amount, reason, earnedAt: new Date().toISOString() }];
      return { newScore, newHistory };
    }, '_computed');
    p = putFrom(p, 'reputation', id, (b) => {
      const c = b._computed as { newScore: number; newHistory: unknown[] };
      return { id, participant, score: c.newScore, history: c.newHistory };
    });
    return completeFrom(p, 'ok', (b) => {
      const c = b._computed as { newScore: number };
      return { entry: id, newScore: c.newScore };
    }) as StorageProgram<Result>;
  },

  burn(input: Record<string, unknown>) {
    const participant = input.participant as string;
    const amount = parseFloat(input.amount as string);

    if (!participant || participant.trim() === '') {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }

    const id = `rep-${participant}`;
    let p = createProgram();
    p = get(p, 'reputation', id, '_existing');
    p = mapBindings(p, (b) => {
      const record = b._existing as Record<string, unknown> | null;
      return record ? (record.score as number) : 0;
    }, '_currentScore');

    return branch(p,
      (b) => !isNaN(amount) && amount > (b._currentScore as number),
      (b) => complete(b, 'error', { message: 'Insufficient reputation to burn' }),
      (b) => {
        let b2 = putFrom(b, 'reputation', id, (bindings) => {
          const record = bindings._existing as Record<string, unknown> | null;
          const currentScore = bindings._currentScore as number;
          const newScore = Math.max(0, currentScore - (isNaN(amount) ? 0 : amount));
          return { ...(record || {}), id, participant, score: newScore };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const currentScore = bindings._currentScore as number;
          const newScore = Math.max(0, currentScore - (isNaN(amount) ? 0 : amount));
          return { entry: id, newScore };
        });
      },
    ) as StorageProgram<Result>;
  },

  decay(input: Record<string, unknown>) {
    const participant = input.participant as string;
    const decayFactor = parseFloat(input.decayFactor as string);

    if (!participant || participant.trim() === '') {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }
    if (!isNaN(decayFactor) && decayFactor < 0) {
      return complete(createProgram(), 'error', { message: 'decayFactor must be non-negative' }) as StorageProgram<Result>;
    }

    const id = `rep-${participant}`;
    let p = createProgram();
    p = get(p, 'reputation', id, '_existing');
    p = mapBindings(p, (b) => {
      const record = b._existing as Record<string, unknown> | null;
      const currentScore = record ? (record.score as number) : 0;
      const factor = isNaN(decayFactor) ? 0 : decayFactor;
      return currentScore * (1 - factor);
    }, '_newScore');
    p = putFrom(p, 'reputation', id, (b) => {
      const record = b._existing as Record<string, unknown> | null;
      const newScore = b._newScore as number;
      return { ...(record || {}), id, participant, score: newScore };
    });
    return completeFrom(p, 'ok', (b) => ({
      entry: id,
      newScore: b._newScore as number,
    })) as StorageProgram<Result>;
  },

  getScore(input: Record<string, unknown>) {
    const participant = input.participant as string;

    if (!participant || participant.trim() === '') {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'reputation', `rep-${participant}`, '_record');

    return branch(p,
      (b) => !b._record,
      (b) => complete(b, 'not_found', { participant }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings._record as Record<string, unknown>;
        return { participant, value: record.score };
      }),
    ) as StorageProgram<Result>;
  },

  recalculate(input: Record<string, unknown>) {
    const participant = input.participant as string;

    if (!participant || participant.trim() === '') {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'reputation', `rep-${participant}`, '_record');
    p = mapBindings(p, (b) => {
      const record = b._record as Record<string, unknown> | null;
      const history = record ? ((record.history as unknown[]) ?? []) : [];
      let newScore = 0;
      for (const h of history) {
        newScore += parseFloat((h as Record<string, unknown>).amount as string) || 0;
      }
      return newScore;
    }, '_newScore');

    return branch(p,
      (b) => !!b._record,
      (b) => {
        let b2 = putFrom(b, 'reputation', `rep-${participant}`, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          return { ...record, score: bindings._newScore as number };
        });
        return completeFrom(b2, 'ok', (bindings) => ({
          participant,
          newScore: bindings._newScore as number,
        }));
      },
      (b) => completeFrom(b, 'ok', (bindings) => ({
        participant,
        newScore: bindings._newScore as number,
      })),
    ) as StorageProgram<Result>;
  },
};

export const reputationHandler = autoInterpret(_reputationHandler);
