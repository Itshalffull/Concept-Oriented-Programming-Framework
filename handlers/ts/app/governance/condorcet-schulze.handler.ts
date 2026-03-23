// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// CondorcetSchulze Counting Method Provider
// Pairwise comparison matrix with Schulze (Floyd-Warshall widest path) resolution.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function computeSchulze(
  ballots: Array<{ voter: string; ranking: string[] }>,
  weightMap: Record<string, number>,
): { winner: string | null; pairwiseMatrix: Record<string, Record<string, number>>; ranking?: Array<{ candidate: string; wins: number }> } {
  // Collect all candidates
  const candidateSet = new Set<string>();
  for (const b of ballots) {
    for (const c of b.ranking) candidateSet.add(c);
  }
  const candidates = Array.from(candidateSet);
  const n = candidates.length;
  const idx = new Map(candidates.map((c, i) => [c, i]));

  // Build pairwise preference matrix d[i][j] = total weight preferring i over j
  const d: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const ballot of ballots) {
    const w = weightMap[ballot.voter] ?? 1;
    for (let i = 0; i < ballot.ranking.length; i++) {
      for (let j = i + 1; j < ballot.ranking.length; j++) {
        const a = idx.get(ballot.ranking[i])!;
        const b = idx.get(ballot.ranking[j])!;
        d[a][b] += w;
      }
    }
  }

  // Schulze method: compute strongest paths via Floyd-Warshall
  const p: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && d[i][j] > d[j][i]) {
        p[i][j] = d[i][j];
      }
    }
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      for (let j = 0; j < n; j++) {
        if (j === i || j === k) continue;
        p[i][j] = Math.max(p[i][j], Math.min(p[i][k], p[k][j]));
      }
    }
  }

  // Determine winner: candidate who beats all others in strongest paths
  let winner: string | null = null;
  for (let i = 0; i < n; i++) {
    let beatsAll = true;
    for (let j = 0; j < n; j++) {
      if (i !== j && p[i][j] <= p[j][i]) {
        beatsAll = false;
        break;
      }
    }
    if (beatsAll) {
      winner = candidates[i];
      break;
    }
  }

  // Build readable pairwise matrix
  const pairwiseMatrix: Record<string, Record<string, number>> = {};
  for (let i = 0; i < n; i++) {
    pairwiseMatrix[candidates[i]] = {};
    for (let j = 0; j < n; j++) {
      if (i !== j) pairwiseMatrix[candidates[i]][candidates[j]] = d[i][j];
    }
  }

  if (!winner) {
    // Rank by number of pairwise wins in strongest paths
    const wins = candidates.map((c, i) => ({
      candidate: c,
      wins: candidates.filter((_, j) => i !== j && p[i][j] > p[j][i]).length,
    }));
    wins.sort((a, b) => b.wins - a.wins);
    return { winner: null, pairwiseMatrix, ranking: wins };
  }

  return { winner, pairwiseMatrix };
}

const _condorcetSchulzeHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `condorcet-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'condorcet', id, {
      id,
      tieBreaker: input.tieBreaker ?? null,
    });

    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'CondorcetSchulze',
      instanceId: id,
    });

    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    if (!input.rankedBallots || (typeof input.rankedBallots === 'string' && (input.rankedBallots as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'rankedBallots is required' }) as StorageProgram<Result>;
    }
    const { config, ballots, weights } = input;

    const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
      Array<{ voter: string; ranking: string[] }>;
    const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
      Record<string, number>;

    const result = computeSchulze(ballotList, weightMap);

    if (result.winner) {
      return complete(createProgram(), 'ok', {
        choice: result.winner,
        pairwiseMatrix: JSON.stringify(result.pairwiseMatrix),
      }) as StorageProgram<Result>;
    }

    return complete(createProgram(), 'no_condorcet_winner', {
      ranking: JSON.stringify(result.ranking),
      pairwiseMatrix: JSON.stringify(result.pairwiseMatrix),
    }) as StorageProgram<Result>;
  },
};

export const condorcetSchulzeHandler = autoInterpret(_condorcetSchulzeHandler);
