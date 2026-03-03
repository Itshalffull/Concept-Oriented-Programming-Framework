// Supermajority Counting Method Provider
// Weighted tally with configurable threshold (e.g., 2/3) and abstention handling.
import type { ConceptHandler } from '@clef/runtime';

export const supermajorityHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `supermaj-${Date.now()}`;
    await storage.put('supermajority', id, {
      id,
      threshold: input.threshold ?? 2 / 3,
      roundingMode: input.roundingMode ?? 'floor',
      abstentionsCount: input.abstentionsCount ?? false,
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'Supermajority',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async count(input, storage) {
    const { config, ballots, weights } = input;
    const cfg = await storage.get('supermajority', config as string);
    const threshold = cfg ? (cfg.threshold as number) : 2 / 3;
    const abstentionsCount = cfg ? (cfg.abstentionsCount as boolean) : false;

    const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
      Array<{ voter: string; choice: string }>;
    const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
      Record<string, number>;

    const tally: Record<string, number> = {};
    let totalWeight = 0;
    let abstainWeight = 0;

    for (const ballot of ballotList) {
      const w = weightMap[ballot.voter] ?? 1;
      if (ballot.choice === 'abstain') {
        abstainWeight += w;
        if (abstentionsCount) totalWeight += w;
        continue;
      }
      tally[ballot.choice] = (tally[ballot.choice] ?? 0) + w;
      totalWeight += w;
    }

    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return { variant: 'no_votes', totalWeight: 0 };
    }

    const [topChoice, topWeight] = entries[0];
    const voteShare = totalWeight > 0 ? topWeight / totalWeight : 0;

    if (voteShare >= threshold) {
      return { variant: 'winner', choice: topChoice, voteShare, requiredShare: threshold, totalWeight, abstentions: abstainWeight };
    }
    return { variant: 'no_supermajority', topChoice, voteShare, requiredShare: threshold, totalWeight, abstentions: abstainWeight };
  },
};
