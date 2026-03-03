// Majority Counting Method Provider
// Simple weighted majority: tallies votes per choice, winner must exceed threshold.
import type { ConceptHandler } from '@clef/runtime';

export const majorityCountHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `maj-${Date.now()}`;
    await storage.put('majority', id, {
      id,
      threshold: input.threshold ?? 0.5,
      binaryOnly: input.binaryOnly ?? true,
      tieBreaker: input.tieBreaker ?? null,
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'Majority',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async count(input, storage) {
    const { config, ballots, weights } = input;
    const cfg = await storage.get('majority', config as string);
    const threshold = cfg ? (cfg.threshold as number) : 0.5;
    const tieBreaker = cfg ? (cfg.tieBreaker as string | null) : null;

    const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
      Array<{ voter: string; choice: string }>;
    const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
      Record<string, number>;

    const tally: Record<string, number> = {};
    let totalWeight = 0;

    for (const ballot of ballotList) {
      const w = weightMap[ballot.voter] ?? 1;
      tally[ballot.choice] = (tally[ballot.choice] ?? 0) + w;
      totalWeight += w;
    }

    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return { variant: 'no_votes', totalWeight: 0 };
    }

    const [topChoice, topWeight] = entries[0];
    const voteShare = totalWeight > 0 ? topWeight / totalWeight : 0;

    if (entries.length > 1 && entries[0][1] === entries[1][1]) {
      if (tieBreaker) {
        return { variant: 'winner', choice: tieBreaker, voteShare: 0.5, totalWeight };
      }
      return { variant: 'tie', choices: JSON.stringify(entries.filter(e => e[1] === topWeight).map(e => e[0])), totalWeight };
    }

    if (voteShare > threshold) {
      return { variant: 'winner', choice: topChoice, voteShare, totalWeight };
    }
    return { variant: 'no_majority', topChoice, voteShare, threshold, totalWeight };
  },
};
