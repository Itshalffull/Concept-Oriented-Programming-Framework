// RankedChoice (IRV) Counting Method Provider
// Instant Runoff Voting: iteratively eliminates the lowest candidate and redistributes ballots.
import type { ConceptHandler } from '@clef/runtime';

export const rankedChoiceHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `rcv-${Date.now()}`;
    await storage.put('rcv', id, {
      id,
      seats: input.seats ?? 1,
      method: input.method ?? 'IRV',
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'RankedChoice',
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

    // Build weighted ballots
    let activeBallots = ballotList.map(b => ({
      ranking: [...b.ranking],
      weight: weightMap[b.voter] ?? 1,
    }));

    const eliminated = new Set<string>();
    const rounds: Array<{ round: number; tally: Record<string, number>; eliminated: string | null }> = [];
    let totalWeight = activeBallots.reduce((s, b) => s + b.weight, 0);
    const majority = totalWeight / 2;

    for (let round = 1; round <= 100; round++) {
      // Count first preferences among non-eliminated candidates
      const tally: Record<string, number> = {};
      for (const ballot of activeBallots) {
        const top = ballot.ranking.find(c => !eliminated.has(c));
        if (top) {
          tally[top] = (tally[top] ?? 0) + ballot.weight;
        }
      }

      const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) break;

      // Check if leader exceeds majority
      if (entries[0][1] > majority) {
        rounds.push({ round, tally, eliminated: null });
        return {
          variant: 'elected',
          winners: JSON.stringify([entries[0][0]]),
          rounds: JSON.stringify(rounds),
        };
      }

      // Eliminate lowest candidate
      const lowest = entries[entries.length - 1][0];
      eliminated.add(lowest);
      rounds.push({ round, tally, eliminated: lowest });

      // If only one candidate remains
      const remaining = entries.filter(e => e[0] !== lowest);
      if (remaining.length <= 1) {
        return {
          variant: 'elected',
          winners: JSON.stringify(remaining.length > 0 ? [remaining[0][0]] : []),
          rounds: JSON.stringify(rounds),
        };
      }
    }

    return { variant: 'exhausted', rounds: JSON.stringify(rounds) };
  },
};
