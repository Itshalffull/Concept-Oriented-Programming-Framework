// @clef-handler style=functional
// CondorcetSchulze Concept Implementation
// Finds the candidate who wins every pairwise comparison using the Schulze method.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `condorcet-config-${++idCounter}`;
}

function buildPairwiseMatrix(
  ballots: Array<{ voter: string; ranking: string[] }>,
  weights: Record<string, number>,
  candidates: string[],
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const a of candidates) {
    matrix[a] = {};
    for (const b of candidates) matrix[a][b] = 0;
  }
  for (const ballot of ballots) {
    const weight = weights[ballot.voter] ?? 1.0;
    for (let i = 0; i < ballot.ranking.length; i++) {
      for (let j = i + 1; j < ballot.ranking.length; j++) {
        const winner = ballot.ranking[i];
        const loser = ballot.ranking[j];
        if (matrix[winner] && matrix[winner][loser] !== undefined) {
          matrix[winner][loser] += weight;
        }
      }
    }
  }
  return matrix;
}

function schulzeStrongestPaths(
  pairwise: Record<string, Record<string, number>>,
  candidates: string[],
): Record<string, Record<string, number>> {
  const paths: Record<string, Record<string, number>> = {};
  for (const a of candidates) {
    paths[a] = {};
    for (const b of candidates) {
      if (a !== b) {
        paths[a][b] = pairwise[a][b] > pairwise[b][a] ? pairwise[a][b] : 0;
      }
    }
  }
  for (const b of candidates) {
    for (const a of candidates) {
      for (const c of candidates) {
        if (a !== b && b !== c && a !== c) {
          paths[a][c] = Math.max(paths[a][c], Math.min(paths[a][b], paths[b][c]));
        }
      }
    }
  }
  return paths;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'CondorcetSchulze' }) as StorageProgram<Result>;
  },

  configure(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'condorcet_config', id, {
      id,
      pairwiseMatrix: '{}',
      strongestPaths: '{}',
      smithSet: null,
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
    p = get(p, 'condorcet_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Condorcet config not found' }),
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

        const candidates = [...new Set(parsedBallots.flatMap(b => b.ranking))];
        const pairwise = buildPairwiseMatrix(parsedBallots, parsedWeights, candidates);
        const paths = schulzeStrongestPaths(pairwise, candidates);

        const pairwiseJson = JSON.stringify(pairwise);
        const pathsJson = JSON.stringify(paths);

        // Check for Condorcet winner
        const winner = candidates.find(a => candidates.every(b => a === b || paths[a][b] > paths[b][a]));

        let b2 = createProgram();
        b2 = put(b2, 'condorcet_config', configId, {
          id: configId,
          pairwiseMatrix: pairwiseJson,
          strongestPaths: pathsJson,
          smithSet: null,
        });

        if (winner) {
          return complete(b2, 'ok', {
            choice: winner,
            pairwiseRecord: pairwiseJson,
          }) as StorageProgram<Result>;
        }

        // Schulze winner: candidate with most path wins
        const ranked = candidates.sort((a, b) => {
          const aWins = candidates.filter(c => c !== a && paths[a][c] > paths[c][a]).length;
          const bWins = candidates.filter(c => c !== b && paths[b][c] > paths[c][b]).length;
          return bWins - aWins;
        });

        const topWins = candidates.filter(c => c !== ranked[0] && paths[ranked[0]][c] > paths[c][ranked[0]]).length;
        const tied = ranked.filter(a => {
          const aWins = candidates.filter(c => c !== a && paths[a][c] > paths[c][a]).length;
          return aWins === topWins;
        });

        if (tied.length > 1) {
          return complete(b2, 'ok', {
            smithSet: JSON.stringify(tied),
          }) as StorageProgram<Result>;
        }

        return complete(b2, 'ok', {
          choice: ranked[0],
          strongestPaths: pathsJson,
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  getPairwiseMatrix(input: Record<string, unknown>) {
    const configId = input.config as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'condorcet_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Condorcet config not found' }),
      completeFrom(createProgram(), 'ok', (b) => {
        const rec = b.configRecord as Record<string, unknown>;
        return { data: rec.pairwiseMatrix };
      }),
    ) as StorageProgram<Result>;
  },
};

export const condorcetSchulzeHandler = autoInterpret(_handler);
