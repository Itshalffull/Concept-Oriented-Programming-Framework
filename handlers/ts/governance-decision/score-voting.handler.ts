// @clef-handler style=functional
// ScoreVoting Concept Implementation
// Allows voters to assign a numeric score to each candidate; the highest average/total wins.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `score-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ScoreVoting' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const minScore = input.minScore as number;
    const maxScore = input.maxScore as number;
    const aggregation = input.aggregation as string;

    if (minScore === undefined || maxScore === undefined) {
      return complete(createProgram(), 'error', { message: 'minScore and maxScore are required' }) as StorageProgram<Result>;
    }
    if (minScore >= maxScore) {
      return complete(createProgram(), 'ok', { minScore, maxScore }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'score_config', id, {
      id,
      minScore,
      maxScore,
      aggregation: aggregation || 'Sum',
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const configId = input.config as string;
    const scoreBallots = input.scoreBallots as string;
    const weights = input.weights as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'score_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Score voting config not found' }),
      (() => {
        let parsedBallots: Array<{ voter: string; scores: Record<string, number> }>;
        let parsedWeights: Record<string, number>;
        try {
          parsedBallots = JSON.parse(scoreBallots);
          parsedWeights = JSON.parse(weights || '{}');
        } catch {
          return complete(createProgram(), 'error', { message: 'Invalid JSON in scoreBallots or weights' }) as StorageProgram<Result>;
        }

        if (!Array.isArray(parsedBallots) || parsedBallots.length === 0) {
          return complete(createProgram(), 'error', { message: 'No ballots provided' }) as StorageProgram<Result>;
        }

        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.configRecord as Record<string, unknown>;
          return rec.aggregation as string;
        }, '_aggregation');

        return completeFrom(b2, 'ok', (b) => {
          const aggregation = b._aggregation as string;
          const candidateScores: Record<string, number[]> = {};
          const candidateWeightedScores: Record<string, number> = {};

          for (const ballot of parsedBallots) {
            const weight = parsedWeights[ballot.voter] ?? 1.0;
            for (const [candidate, score] of Object.entries(ballot.scores || {})) {
              if (!candidateScores[candidate]) candidateScores[candidate] = [];
              candidateScores[candidate].push(score);
              candidateWeightedScores[candidate] = (candidateWeightedScores[candidate] || 0) + score * weight;
            }
          }

          const aggregated: Record<string, number> = {};
          for (const [candidate, scores] of Object.entries(candidateScores)) {
            if (aggregation === 'Average' || aggregation === 'Mean') {
              aggregated[candidate] = candidateWeightedScores[candidate] / scores.length;
            } else if (aggregation === 'Median') {
              const sorted = [...scores].sort((a, c) => a - c);
              const mid = Math.floor(sorted.length / 2);
              aggregated[candidate] = sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
            } else {
              aggregated[candidate] = candidateWeightedScores[candidate];
            }
          }

          const ranked = Object.entries(aggregated).sort((a, c) => c[1] - a[1]);
          const topScore = ranked[0][1];
          const tied = ranked.filter(([, s]) => s === topScore);

          if (tied.length > 1) {
            return {
              choices: JSON.stringify(tied.map(([c]) => c)),
              aggregateScore: topScore,
            };
          }
          return {
            choice: ranked[0][0],
            aggregateScore: topScore,
            details: JSON.stringify(ranked),
          };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const scoreVotingHandler = autoInterpret(_handler);
