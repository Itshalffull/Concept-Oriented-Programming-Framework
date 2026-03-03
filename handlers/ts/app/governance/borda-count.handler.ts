// BordaCount Counting Method Provider
// Positional scoring: each ranking position awards points via Standard, Modified, or Dowdall schemes.
import type { ConceptHandler } from '@clef/runtime';

export const bordaCountHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `borda-${Date.now()}`;
    await storage.put('borda', id, {
      id,
      scheme: input.scheme ?? 'Standard',
      candidates: input.candidates,
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'BordaCount',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async count(input, storage) {
    const { config, ballots, weights } = input;
    const cfg = await storage.get('borda', config as string);
    const scheme = cfg ? (cfg.scheme as string) : 'Standard';

    const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
      Array<{ voter: string; ranking: string[] }>;
    const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
      Record<string, number>;

    const scores: Record<string, number> = {};

    for (const ballot of ballotList) {
      const w = weightMap[ballot.voter] ?? 1;
      const n = ballot.ranking.length;

      for (let i = 0; i < n; i++) {
        const candidate = ballot.ranking[i];
        let points: number;

        switch (scheme) {
          case 'Modified':
            points = n - i;
            break;
          case 'Dowdall':
            points = 1 / (i + 1);
            break;
          case 'Standard':
          default:
            points = n - 1 - i;
            break;
        }

        scores[candidate] = (scores[candidate] ?? 0) + points * w;
      }
    }

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winner = ranked.length > 0 ? ranked[0][0] : null;

    return {
      variant: 'winner',
      choice: winner,
      scores: JSON.stringify(Object.fromEntries(ranked)),
    };
  },
};
