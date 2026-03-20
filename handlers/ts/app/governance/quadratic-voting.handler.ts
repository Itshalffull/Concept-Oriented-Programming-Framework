// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// QuadraticVoting Counting Method Provider
// Credit-based voting: cost = votes squared, voters allocate from a fixed credit budget.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _quadraticVotingHandler: FunctionalConceptHandler = {
  openSession(input: Record<string, unknown>) {
    const id = `qv-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'qv_session', id, {
      id,
      creditBudget: input.creditBudget as number,
      options: input.options,
      status: 'open',
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'QuadraticVoting',
      instanceId: id,
    });
    return complete(p, 'opened', { session: id }) as StorageProgram<Result>;
  },

  castVotes(input: Record<string, unknown>) {
    const { session, voter, allocations } = input;
    const allocs = (typeof allocations === 'string' ? JSON.parse(allocations as string) : allocations) as
      Record<string, number>;
    let p = createProgram();
    p = get(p, 'qv_session', session as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'open') return { _castError: 'session_closed' };

          const budget = record.creditBudget as number;

          let totalCost = 0;
          for (const votes of Object.values(allocs)) {
            totalCost += votes * votes;
          }

          if (totalCost > budget) {
            return { _castError: 'budget_exceeded', totalCost, budget };
          }

          return { _castError: null, totalCost, remainingCredits: budget - totalCost };
        }, 'castCheck');

        // Store the vote record for later tallying
        const voteId = `${session}:${voter}`;
        b = put(b, 'qv_vote', voteId, { id: voteId, session, voter, allocations: allocs });

        return completeFrom(b, 'cast', (bindings) => {
          const check = bindings.castCheck as Record<string, unknown>;
          if (check._castError === 'session_closed') {
            return { variant: 'session_closed', session };
          }
          if (check._castError === 'budget_exceeded') {
            return { variant: 'budget_exceeded', totalCost: check.totalCost, budget: check.budget };
          }
          return { variant: 'cast', session, voter, totalCost: check.totalCost, remainingCredits: check.remainingCredits };
        });
      },
      (b) => complete(b, 'not_found', { session }),
    );

    return p as StorageProgram<Result>;
  },

  tally(input: Record<string, unknown>) {
    const { session } = input;
    let p = createProgram();
    p = get(p, 'qv_session', session as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = find(b, 'qv_vote', { session: session as string }, 'allVotes');
        b = mapBindings(b, (bindings) => {
          const allVotes = bindings.allVotes as Array<Record<string, unknown>>;
          const votesByOption: Record<string, number> = {};
          for (const vote of allVotes) {
            const allocs = vote.allocations as Record<string, number>;
            for (const [option, votes] of Object.entries(allocs)) {
              votesByOption[option] = (votesByOption[option] ?? 0) + votes;
            }
          }
          const ranked = Object.entries(votesByOption).sort((a, b) => b[1] - a[1]);
          const winner = ranked.length > 0 ? ranked[0][0] : null;
          return { winner, votesByOption: JSON.stringify(votesByOption) };
        }, 'tallyResult');

        let b2 = put(b, 'qv_session', session as string, { status: 'tallied' });

        return completeFrom(b2, 'result', (bindings) => {
          const tallyResult = bindings.tallyResult as Record<string, unknown>;
          return { session, winner: tallyResult.winner, votesByOption: tallyResult.votesByOption };
        });
      },
      (b) => complete(b, 'not_found', { session }),
    );

    return p as StorageProgram<Result>;
  },
};

export const quadraticVotingHandler = autoInterpret(_quadraticVotingHandler);
