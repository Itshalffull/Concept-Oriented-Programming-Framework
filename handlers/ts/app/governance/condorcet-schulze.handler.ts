// CondorcetSchulze Counting Method Provider
// Pairwise comparison matrix with Schulze (Floyd-Warshall widest path) resolution.
import type { ConceptHandler } from '@clef/runtime';

export const condorcetSchulzeHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `condorcet-${Date.now()}`;
    await storage.put('condorcet', id, {
      id,
      tieBreaker: input.tieBreaker ?? null,
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'CondorcetSchulze',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async count(input, storage) {
    const { config, ballots, weights } = input;

    const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
      Array<{ voter: string; ranking: string[] }>;
    const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
      Record<string, number>;

    // Collect all candidates
    const candidateSet = new Set<string>();
    for (const b of ballotList) {
      for (const c of b.ranking) candidateSet.add(c);
    }
    const candidates = Array.from(candidateSet);
    const n = candidates.length;
    const idx = new Map(candidates.map((c, i) => [c, i]));

    // Build pairwise preference matrix d[i][j] = total weight preferring i over j
    const d: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (const ballot of ballotList) {
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

    if (winner) {
      return {
        variant: 'winner',
        choice: winner,
        pairwiseMatrix: JSON.stringify(pairwiseMatrix),
      };
    }

    // Rank by number of pairwise wins in strongest paths
    const wins = candidates.map((c, i) => ({
      candidate: c,
      wins: candidates.filter((_, j) => i !== j && p[i][j] > p[j][i]).length,
    }));
    wins.sort((a, b) => b.wins - a.wins);

    return {
      variant: 'no_condorcet_winner',
      ranking: JSON.stringify(wins),
      pairwiseMatrix: JSON.stringify(pairwiseMatrix),
    };
  },
};
