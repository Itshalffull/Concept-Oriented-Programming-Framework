// @clef-handler style=functional
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

function parseBallots(raw: unknown): Array<{ voter: string; scores: Record<string, number> }> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (Array.isArray(raw)) return raw as Array<{ voter: string; scores: Record<string, number> }>;
  return null;
}

const _scoreVotingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const minS = typeof input.minScore === 'string' ? parseFloat(input.minScore as string) : (input.minScore as number);
    const maxS = typeof input.maxScore === 'string' ? parseFloat(input.maxScore as string) : (input.maxScore as number);
    if (minS !== undefined && !isNaN(minS) && maxS !== undefined && !isNaN(maxS) && minS >= maxS) {
      return complete(createProgram(), 'error', { message: 'minScore must be less than maxScore' }) as StorageProgram<Result>;
    }
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
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, weights } = input;
    // Support both 'scoreBallots' (spec field) and 'ballots' (legacy)
    const rawBallots = input.scoreBallots ?? input.ballots;

    const ballotList = parseBallots(rawBallots);

    if (!ballotList || ballotList.length === 0) {
      return complete(createProgram(), 'error', { message: 'ballots are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'score_cfg', config as string, 'cfg');

    return completeFrom(p, 'ok', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const aggregation = cfg ? (cfg.aggregation as string) : 'Mean';

      const weightMap = (typeof weights === 'string' ? (() => { try { return JSON.parse(weights as string); } catch { return {}; } })() : weights ?? {}) as
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
    }) as StorageProgram<Result>;
  },
};

export const scoreVotingHandler = autoInterpret(_scoreVotingHandler);
