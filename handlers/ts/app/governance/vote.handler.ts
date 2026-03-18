// @migrated dsl-constructs 2026-03-18
// Vote Concept Handler
// Session-based voting with weighted ballot collection and tallying.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _voteHandler: FunctionalConceptHandler = {
  openSession(input: Record<string, unknown>) {
    const id = `session-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'session', id, {
      id, proposalRef: input.proposalRef, deadline: input.deadline,
      snapshotRef: input.snapshotRef, status: 'Open', ballots: [], createdAt: new Date().toISOString(),
    });
    return complete(p, 'opened', { session: id }) as StorageProgram<Result>;
  },

  castVote(input: Record<string, unknown>) {
    const { session, voter, choice, weight } = input;
    let p = createProgram();
    p = get(p, 'session', session as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'cast', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Open') return { variant: 'closed', session };
          const ballots = record.ballots as Array<{ voter: unknown; choice: unknown; weight: unknown }>;
          if (ballots.some(bl => bl.voter === voter)) return { variant: 'already_voted', voter };
          return { variant: 'cast', ballot: `${session}:${voter}` };
        });
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
        let b2 = put(b, 'session', session as string, { status: 'Closed' });
        return complete(b2, 'closed', { session });
      },
      (b) => complete(b, 'not_found', { session }),
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

        let b2 = put(b, 'session', session as string, { status: 'Tallied' });

        return completeFrom(b2, 'result', (bindings) => {
          const result = bindings.tallyResult as Record<string, unknown>;
          return { session, outcome: result.outcome, totals: result.totals };
        });
      },
      (b) => complete(b, 'not_found', { session }),
    );

    return p as StorageProgram<Result>;
  },
};

export const voteHandler = autoInterpret(_voteHandler);
