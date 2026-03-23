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

/** Resolve an id value that may be a string, object ref, or number. */
function resolveId(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return String((val as Record<string, unknown>).id ?? '') || JSON.stringify(val);
  return String(val);
}

let sessionCounter = 0;

const _quadraticVotingHandler: FunctionalConceptHandler = {
  openSession(input: Record<string, unknown>) {
    const creditBudget = input.creditBudget as number;
    const options = input.options as string[];
    const sessionId = `qv-session-${++sessionCounter}`;
    let p = createProgram();
    p = put(p, 'qv_session', sessionId, {
      id: sessionId,
      creditBudget,
      options,
      status: 'open',
    });
    return complete(p, 'opened', { session: sessionId }) as StorageProgram<Result>;
  },
  configure(input: Record<string, unknown>) {
    const creditBudget = parseFloat(input.creditBudget as string);
    if (!input.creditBudget || isNaN(creditBudget) || creditBudget <= 0) {
      return complete(createProgram(), 'error', { message: 'creditBudget must be a positive number' }) as StorageProgram<Result>;
    }
    const id = `qv-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'qv_config', id, {
      id,
      creditBudget,
      status: 'open',
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'QuadraticVoting',
      instanceId: id,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  allocateCredits(input: Record<string, unknown>) {
    const configId = resolveId(input.config);
    const voter = input.voter as string | undefined;
    if (!configId || !voter) {
      return complete(createProgram(), 'error', { message: 'config and voter are required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'qv_config', configId, 'record');

    p = branch(p, 'record',
      (b) => {
        // Check for duplicate allocation
        b = get(b, 'qv_allocation', `${configId}:${voter}`, 'existing');
        return branch(b, 'existing',
          (existsB) => complete(existsB, 'error', { message: 'voter already allocated', config: configId, voter }),
          (newB) => {
            newB = put(newB, 'qv_allocation', `${configId}:${voter}`, {
              config: configId, voter, allocatedAt: new Date().toISOString(),
            });
            return complete(newB, 'ok', { config: configId, voter });
          },
        );
      },
      (b) => complete(b, 'not_found', { config: configId }),
    );

    return p as StorageProgram<Result>;
  },

  castVotes(input: Record<string, unknown>) {
    // Session-based API: { session, voter, allocations: { option: votes } }
    const sessionId = input.session as string | undefined;
    if (sessionId) {
      const voter = input.voter as string;
      const allocations = input.allocations as Record<string, number>;

      let p = createProgram();
      p = get(p, 'qv_session', sessionId, 'session');

      return branch(p, 'session',
        (b) => {
          b = mapBindings(b, (bindings) => {
            const session = bindings.session as Record<string, unknown>;
            const budget = session.creditBudget as number;
            let totalCost = 0;
            for (const votes of Object.values(allocations)) {
              totalCost += votes * votes;
            }
            return { totalCost, budget, exceeded: totalCost > budget };
          }, 'costCheck');

          return branch(b,
            (bindings) => (bindings.costCheck as Record<string, unknown>).exceeded as boolean,
            (bp) => completeFrom(bp, 'budget_exceeded', (bindings) => {
              const check = bindings.costCheck as Record<string, unknown>;
              return { totalCost: check.totalCost, budget: check.budget };
            }),
            (bp) => {
              const voteId = `${sessionId}:${voter}`;
              bp = put(bp, 'qv_session_vote', voteId, {
                id: voteId,
                session: sessionId,
                voter,
                allocations,
              });
              return completeFrom(bp, 'cast', (bindings) => {
                const check = bindings.costCheck as Record<string, unknown>;
                return { totalCost: check.totalCost };
              });
            },
          );
        },
        (b) => complete(b, 'not_found', { session: sessionId }),
      ) as StorageProgram<Result>;
    }

    // Legacy config-based API
    const configId = resolveId(input.config);
    const voter = input.voter as string | undefined;
    const issue = input.issue as string | undefined;
    if (!configId || !voter) {
      return complete(createProgram(), 'error', { message: 'config and voter are required' }) as StorageProgram<Result>;
    }
    const votes = typeof input.numberOfVotes === 'number' ? input.numberOfVotes : parseInt(input.numberOfVotes as string, 10) || 0;
    const cost = votes * votes;

    let p = createProgram();
    p = get(p, 'qv_config', configId, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const budget = record.creditBudget as number;
          if (cost > budget) {
            return { _error: 'budget_exceeded', cost, budget };
          }
          return { _error: null, cost, remainingCredits: budget - cost };
        }, 'castCheck');

        const voteId = `${configId}:${voter}:${issue}`;
        b = put(b, 'qv_vote', voteId, { id: voteId, config: configId, voter, issue, numberOfVotes: votes, cost });

        return completeFrom(b, 'cast', (bindings) => {
          const check = bindings.castCheck as Record<string, unknown>;
          if (check._error === 'budget_exceeded') {
            return { message: 'budget_exceeded', cost: check.cost, budget: check.budget };
          }
          return { config: configId, voter, issue, cost: check.cost, remainingCredits: check.remainingCredits };
        });
      },
      (b) => complete(b, 'not_found', { config: configId }),
    );

    return p as StorageProgram<Result>;
  },

  tally(input: Record<string, unknown>) {
    const sessionId = input.session as string;
    let p = createProgram();
    p = find(p, 'qv_session_vote', { session: sessionId }, 'allVotes');

    return completeFrom(p, 'result', (bindings) => {
      const allVotes = bindings.allVotes as Array<Record<string, unknown>>;
      const votesByOption: Record<string, number> = {};
      for (const vote of allVotes) {
        const allocations = vote.allocations as Record<string, number>;
        for (const [option, votes] of Object.entries(allocations)) {
          votesByOption[option] = (votesByOption[option] ?? 0) + votes;
        }
      }
      return { votesByOption: JSON.stringify(votesByOption) };
    }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const configId = resolveId(input.config);
    const issue = input.issue as string | undefined;
    if (!configId) {
      return complete(createProgram(), 'not_found', { config: configId }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'qv_config', configId, 'record');

    p = branch(p, 'record',
      (b) => {
        b = find(b, 'qv_vote', { config: configId }, 'allVotes');
        b = mapBindings(b, (bindings) => {
          const allVotes = bindings.allVotes as Array<Record<string, unknown>>;
          const filtered = issue ? allVotes.filter(v => v.issue === issue) : allVotes;
          const votesByIssue: Record<string, number> = {};
          for (const vote of filtered) {
            const k = vote.issue as string;
            votesByIssue[k] = (votesByIssue[k] ?? 0) + (vote.numberOfVotes as number);
          }
          const ranked = Object.entries(votesByIssue).sort((a, bv) => bv[1] - a[1]);
          const winner = ranked.length > 0 ? ranked[0][0] : null;
          return { winner, votesByIssue: JSON.stringify(votesByIssue) };
        }, 'tallyResult');

        return completeFrom(b, 'ok', (bindings) => {
          const t = bindings.tallyResult as Record<string, unknown>;
          return { config: configId, issue, winner: t.winner, votesByIssue: t.votesByIssue };
        });
      },
      (b) => complete(b, 'not_found', { config: configId }),
    );

    return p as StorageProgram<Result>;
  },
};

export const quadraticVotingHandler = autoInterpret(_quadraticVotingHandler);
