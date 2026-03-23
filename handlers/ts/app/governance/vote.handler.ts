// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Vote Concept Handler
// Session-based voting with weighted ballot collection and tallying.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _voteHandler: FunctionalConceptHandler = {
  openSession(input: Record<string, unknown>) {
    if (!input.proposalRef || (typeof input.proposalRef === 'string' && (input.proposalRef as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }
    const id = `session-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'session', id, {
      id, proposalRef: input.proposalRef, deadline: input.deadline,
      snapshotRef: input.snapshotRef ?? null, status: 'Open', ballots: [], createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { session: id, id }) as StorageProgram<Result>;
  },

  castVote(input: Record<string, unknown>) {
    const { session, voter, choice, weight } = input;
    let p = createProgram();
    p = get(p, 'session', session as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => (bindings.record as Record<string, unknown>).status === 'Open',
          (b2) => {
            return branch(b2,
              (bindings) => {
                const ballots = (bindings.record as Record<string, unknown>).ballots as Array<{ voter: unknown }>;
                return !ballots.some(bl => bl.voter === voter);
              },
              (b3) => {
                let b4 = putFrom(b3, 'session', session as string, (bindings) => {
                  const record = bindings.record as Record<string, unknown>;
                  const ballots = record.ballots as Array<{ voter: unknown; choice: unknown; weight: unknown }>;
                  return { ...record, ballots: [...ballots, { voter, choice, weight }] };
                });
                return complete(b4, 'recorded', { vote: `${session}:${voter}` }) as StorageProgram<Result>;
              },
              (b3) => complete(b3, 'ok', { voter }),
            );
          },
          (b2) => complete(b2, 'ok', { session }),
        );
      },
      (b) => complete(b, 'session_not_found', { session }),
    );

    return p as StorageProgram<Result>;
  },

  close(input: Record<string, unknown>) {
    const { session } = input;
    let p = createProgram();
    p = get(p, 'session', session as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'session', session as string, (bindings) => ({
          ...bindings.record as Record<string, unknown>, status: 'Closed',
        }));
        return complete(b2, 'ok', { session });
      },
      (b) => complete(b, 'error', { message: `Session not found: ${session}` }),
    );

    return p as StorageProgram<Result>;
  },

  tally(input: Record<string, unknown>) {
    const { session } = input;
    let p = createProgram();
    p = get(p, 'session', session as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const ballots = record.ballots as Array<{ choice: string; weight: number }>;
          const totals: Record<string, number> = {};
          for (const bl of ballots) {
            totals[bl.choice] = (totals[bl.choice] ?? 0) + (bl.weight ?? 1);
          }
          const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
          const outcome = winner ? winner[0] : 'no_result';
          return { outcome, totals: JSON.stringify(totals) };
        }, 'tallyResult');

        let b2 = putFrom(b, 'session', session as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const result = bindings.tallyResult as Record<string, unknown>;
          return { ...record, status: 'Tallied', outcome: result.outcome, totals: result.totals };
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const result = bindings.tallyResult as Record<string, unknown>;
          return { session, outcome: result.outcome, details: result.totals };
        });
      },
      (b) => complete(b, 'error', { message: `Session not found: ${session}` }),
    );

    return p as StorageProgram<Result>;
  },
};

export const voteHandler = autoInterpret(_voteHandler);
