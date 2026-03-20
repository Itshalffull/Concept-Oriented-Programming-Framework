// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// BordaCount Counting Method Provider
// Positional scoring: each ranking position awards points via Standard, Modified, or Dowdall schemes.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function computeBordaScores(
  ballots: Array<{ voter: string; ranking: string[] }>,
  weightMap: Record<string, number>,
  scheme: string,
): { ranked: [string, number][]; winner: string | null } {
  const scores: Record<string, number> = {};

  for (const ballot of ballots) {
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
  return { ranked, winner };
}

const _bordaCountHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `borda-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'borda', id, {
      id,
      scheme: input.scheme ?? 'Standard',
      candidates: input.candidates,
    });

    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'BordaCount',
      instanceId: id,
    });

    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, ballots, weights } = input;
    let p = createProgram();
    p = get(p, 'borda', config as string, 'cfg');

    return completeFrom(p, 'winner', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const scheme = cfg ? (cfg.scheme as string) : 'Standard';

      const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
        Array<{ voter: string; ranking: string[] }>;
      const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
        Record<string, number>;

      const { ranked, winner } = computeBordaScores(ballotList, weightMap, scheme);

      return {
        variant: 'winner',
        choice: winner,
        scores: JSON.stringify(Object.fromEntries(ranked)),
      };
    }) as StorageProgram<Result>;
  },
};

export const bordaCountHandler = autoInterpret(_bordaCountHandler);
