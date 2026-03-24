// @clef-handler style=functional
// QuadraticVoting Concept Implementation
// Allows participants to express intensity of preference; casting N votes costs N² credits.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `qv-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'QuadraticVoting' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const creditBudget = input.creditBudget as number;

    if (creditBudget === undefined || creditBudget === null || creditBudget <= 0) {
      return complete(createProgram(), 'error', { message: 'creditBudget must be greater than zero' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'qv_config', id, { id, creditBudget });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  allocateCredits(input: Record<string, unknown>) {
    const configId = input.config as string;
    const voter = input.voter as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'qv_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'QV config not found' }),
      (() => {
        const balanceKey = `${configId}::${voter}`;
        let b2 = createProgram();
        b2 = get(b2, 'qv_balance', balanceKey, 'existingBalance');

        return branch(
          b2,
          (b) => !!b.existingBalance,
          complete(createProgram(), 'ok', { voter }),
          (() => {
            let b3 = createProgram();
            b3 = mapBindings(b3, (b) => {
              const rec = b.configRecord as Record<string, unknown>;
              return rec.creditBudget as number;
            }, '_budget');
            b3 = putFrom(b3, 'qv_balance', balanceKey, (b) => ({
              voter,
              remaining: b._budget,
              spent: [],
            }));
            return completeFrom(b3, 'ok', (b) => ({
              voter,
              credits: b._budget,
            })) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  castVotes(input: Record<string, unknown>) {
    const configId = input.config as string;
    const voter = input.voter as string;
    const issue = input.issue as string;
    const numberOfVotes = input.numberOfVotes as number;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    const creditsNeeded = numberOfVotes * numberOfVotes;
    const balanceKey = `${configId}::${voter}`;

    let p = createProgram();
    p = get(p, 'qv_balance', balanceKey, 'balanceRecord');

    return branch(
      p,
      (b) => !b.balanceRecord,
      complete(createProgram(), 'ok', { voter }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.balanceRecord as Record<string, unknown>;
          return rec.remaining as number;
        }, '_remaining');

        return branch(
          b2,
          (b) => (b._remaining as number) < creditsNeeded,
          completeFrom(createProgram(), 'ok', (b) => ({
            voter,
            needed: creditsNeeded,
            available: b._remaining,
          })),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'qv_balance', balanceKey, (b) => {
              const rec = b.balanceRecord as Record<string, unknown>;
              const remaining = (rec.remaining as number) - creditsNeeded;
              const spent = [...(rec.spent as unknown[]), { issue, votesCast: numberOfVotes, creditsSpent: creditsNeeded }];
              return { ...rec, remaining, spent };
            });
            return completeFrom(b3, 'ok', (b) => ({
              voter,
              votesCast: numberOfVotes,
              creditsSpent: creditsNeeded,
              remaining: (b._remaining as number) - creditsNeeded,
            })) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const configId = input.config as string;
    const issue = input.issue as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'qv_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'QV config not found' }),
      (() => {
        // Find all balance records for this config and tally votes for the issue
        let b2 = createProgram();
        b2 = find(b2, 'qv_balance', {}, 'allBalances');
        return completeFrom(b2, 'ok', (b) => {
          const balances = (b.allBalances || []) as Array<Record<string, unknown>>;
          const choiceCounts: Record<string, number> = {};

          for (const balance of balances) {
            const spent = (balance.spent || []) as Array<{ issue: string; votesCast: number }>;
            for (const entry of spent) {
              if (entry.issue === issue) {
                // QV counts votes (not credits), so each "yes" or positive vote counts
                choiceCounts['yes'] = (choiceCounts['yes'] || 0) + entry.votesCast;
              }
            }
          }

          if (Object.keys(choiceCounts).length === 0) {
            return { choice: 'none', totalVotes: 0, details: 'No votes for this issue' };
          }

          const ranked = Object.entries(choiceCounts).sort((a, c) => c[1] - a[1]);
          const topScore = ranked[0][1];
          const tied = ranked.filter(([, s]) => s === topScore);

          if (tied.length > 1) {
            return {
              choices: JSON.stringify(tied.map(([c]) => c)),
              totalVotes: topScore,
            };
          }
          return {
            choice: ranked[0][0],
            totalVotes: topScore,
            details: JSON.stringify(ranked),
          };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const quadraticVotingHandler = autoInterpret(_handler);
