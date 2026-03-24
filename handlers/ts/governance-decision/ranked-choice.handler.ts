// @clef-handler style=functional
// RankedChoice Concept Implementation
// Elects a winner through iterative elimination of the candidate with fewest first-preference votes.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `rcv-config-${++idCounter}`;
}

function runInstantRunoff(
  ballots: Array<{ voter: string; ranking: string[] }>,
  weights: Record<string, number>,
): { winner: string | null; rounds: Array<{ eliminated: string; voteCounts: Record<string, number> }> } {
  let remaining = [...new Set(ballots.flatMap(b => b.ranking))];
  const rounds: Array<{ eliminated: string; voteCounts: Record<string, number> }> = [];

  while (remaining.length > 1) {
    const counts: Record<string, number> = {};
    for (const c of remaining) counts[c] = 0;

    let total = 0;
    for (const ballot of ballots) {
      const top = ballot.ranking.find(c => remaining.includes(c));
      if (top) {
        const weight = weights[ballot.voter] ?? 1.0;
        counts[top] += weight;
        total += weight;
      }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > total / 2) {
      return { winner: sorted[0][0], rounds };
    }

    const eliminated = sorted[sorted.length - 1][0];
    rounds.push({ eliminated, voteCounts: counts });
    remaining = remaining.filter(c => c !== eliminated);
  }

  return { winner: remaining[0] || null, rounds };
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'RankedChoice' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const eliminationMethod = input.eliminationMethod as string;
    const seats = input.seats as number;

    if (!eliminationMethod || eliminationMethod.trim() === '') {
      return complete(createProgram(), 'error', { message: 'eliminationMethod is required' }) as StorageProgram<Result>;
    }

    const validMethods = new Set(['InstantRunoff', 'SingleTransferable']);
    if (!validMethods.has(eliminationMethod)) {
      return complete(createProgram(), 'error', { message: `Invalid eliminationMethod. Must be one of: ${[...validMethods].join(', ')}` }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'rcv_config', id, {
      id,
      eliminationMethod,
      seats: seats ?? 1,
      rounds: [],
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const configId = input.config as string;
    const rankedBallots = input.rankedBallots as string;
    const weights = input.weights as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'rcv_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'RCV config not found' }),
      (() => {
        let parsedBallots: Array<{ voter: string; ranking: string[] }>;
        let parsedWeights: Record<string, number>;
        try {
          parsedBallots = JSON.parse(rankedBallots);
          parsedWeights = JSON.parse(weights || '{}');
        } catch {
          return complete(createProgram(), 'error', { message: 'Invalid JSON in rankedBallots or weights' }) as StorageProgram<Result>;
        }

        if (!Array.isArray(parsedBallots) || parsedBallots.length === 0) {
          return complete(createProgram(), 'error', { message: 'No ballots provided' }) as StorageProgram<Result>;
        }

        const { winner, rounds } = runInstantRunoff(parsedBallots, parsedWeights);
        const finalRound = rounds.length + 1;

        let b2 = createProgram();
        // Store round details
        rounds.forEach((round, idx) => {
          const roundKey = `${configId}::round::${idx + 1}`;
          b2 = put(b2, 'rcv_round', roundKey, {
            roundNumber: idx + 1,
            eliminated: round.eliminated,
            voteCounts: JSON.stringify(round.voteCounts),
            transfers: '{}',
          });
        });

        if (!winner) {
          // Exhausted ballots
          const remaining = [...new Set(parsedBallots.flatMap(b => b.ranking))];
          return complete(b2, 'ok', {
            remainingCandidates: JSON.stringify(remaining),
            finalRound,
          }) as StorageProgram<Result>;
        }

        return complete(b2, 'ok', {
          choice: winner,
          finalRound,
          roundDetails: JSON.stringify(rounds),
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  getRoundDetail(input: Record<string, unknown>) {
    const configId = input.config as string;
    const roundNumber = input.roundNumber as number;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    const roundKey = `${configId}::round::${roundNumber}`;
    let p = createProgram();
    p = get(p, 'rcv_round', roundKey, 'roundRecord');

    return branch(
      p,
      (b) => !b.roundRecord,
      complete(createProgram(), 'not_found', { roundNumber }),
      completeFrom(createProgram(), 'ok', (b) => {
        const rec = b.roundRecord as Record<string, unknown>;
        return {
          eliminated: rec.eliminated,
          voteCounts: rec.voteCounts,
          transfers: rec.transfers,
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const rankedChoiceHandler = autoInterpret(_handler);
