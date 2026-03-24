// @clef-handler style=functional
// BordaCount Concept Implementation
// Assigns points based on rank position; the candidate with the most points wins.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `borda-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'BordaCount' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const pointScheme = input.pointScheme as string;

    if (!pointScheme || pointScheme.trim() === '') {
      return complete(createProgram(), 'error', { message: 'pointScheme is required' }) as StorageProgram<Result>;
    }

    const validSchemes = new Set(['Standard', 'Modified', 'Dowdall']);
    if (!validSchemes.has(pointScheme)) {
      return complete(createProgram(), 'error', { message: `Invalid pointScheme. Must be one of: ${[...validSchemes].join(', ')}` }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'borda_config', id, { id, pointScheme });
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
    p = get(p, 'borda_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Borda config not found' }),
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

        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.configRecord as Record<string, unknown>;
          return rec.pointScheme as string;
        }, '_scheme');

        return completeFrom(b2, 'ok', (b) => {
          const scheme = b._scheme as string;
          const scores: Record<string, number> = {};

          for (const ballot of parsedBallots) {
            const n = ballot.ranking.length;
            const weight = parsedWeights[ballot.voter] ?? 1.0;
            ballot.ranking.forEach((candidate, rank) => {
              let points: number;
              if (scheme === 'Standard') points = (n - 1 - rank) * weight;
              else if (scheme === 'Modified') points = (n - rank) * weight;
              else points = (1 / (rank + 1)) * weight; // Dowdall
              scores[candidate] = (scores[candidate] || 0) + points;
            });
          }

          const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          const topScore = ranked[0][1];
          const tied = ranked.filter(([, s]) => s === topScore);

          if (tied.length > 1) {
            return {
              choices: JSON.stringify(tied.map(([c]) => c)),
              totalPoints: topScore,
            };
          }
          return {
            choice: ranked[0][0],
            totalPoints: topScore,
            details: JSON.stringify(ranked),
          };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const bordaCountHandler = autoInterpret(_handler);
