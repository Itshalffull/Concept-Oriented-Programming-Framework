// @migrated dsl-constructs 2026-03-18
// ScoreVoting Counting Method Provider
// Voters score each candidate within a range; aggregates by weighted mean or median.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _scoreVotingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `score-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'score_cfg', id, {
      id,
      minScore: input.minScore ?? 0,
      maxScore: input.maxScore ?? 5,
      aggregation: input.aggregation ?? 'Mean',
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'ScoreVoting',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, ballots, weights } = input;
    let p = createProgram();
    p = get(p, 'score_cfg', config as string, 'cfg');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const aggregation = cfg ? (cfg.aggregation as string) : 'Mean';

      const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots as string) : ballots) as
        Array<{ voter: string; scores: Record<string, number> }>;
      const weightMap = (typeof weights === 'string' ? JSON.parse(weights as string) : weights ?? {}) as
        Record<string, number>;

      const perCandidate: Record<string, { weightedScores: number[]; weights: number[] }> = {};

      for (const ballot of ballotList) {
        const w = weightMap[ballot.voter] ?? 1;
        for (const [candidate, score] of Object.entries(ballot.scores)) {
          if (!perCandidate[candidate]) perCandidate[candidate] = { weightedScores: [], weights: [] };
          perCandidate[candidate].weightedScores.push(score * w);
          perCandidate[candidate].weights.push(w);
        }
      }

      const results: Array<{ choice: string; aggregate: number }> = [];
      const distribution: Record<string, number> = {};

      for (const [candidate, data] of Object.entries(perCandidate)) {
        let aggregate: number;
        if (aggregation === 'Median') {
          const sorted = data.weightedScores
            .map((ws, i) => ws / data.weights[i])
            .sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          aggregate = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
          const totalW = data.weights.reduce((s, w) => s + w, 0);
          aggregate = totalW > 0 ? data.weightedScores.reduce((s, w) => s + w, 0) / totalW : 0;
        }
        results.push({ choice: candidate, aggregate });
        distribution[candidate] = aggregate;
      }

      results.sort((a, b) => b.aggregate - a.aggregate);
      const winner = results.length > 0 ? results[0] : null;

      return {
        choice: winner?.choice ?? null,
        averageScore: winner?.aggregate ?? 0,
        distribution: JSON.stringify(distribution),
      };
    }, 'countResult');

    return completeFrom(p, 'winner', (bindings) => {
      return bindings.countResult as Record<string, unknown>;
    }) as StorageProgram<Result>;
  },
};

export const scoreVotingHandler = autoInterpret(_scoreVotingHandler);
