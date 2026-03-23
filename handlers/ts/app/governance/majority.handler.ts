// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Majority Counting Method Provider
// Simple weighted majority: tallies votes per choice, winner must exceed threshold.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/** Pure function to tally ballots and determine outcome. */
function tallyBallots(
  ballots: Array<{ voter: string; choice: string }>,
  weights: Record<string, number>,
  threshold: number,
  tieBreaker: string | null,
): Record<string, unknown> {
  const tally: Record<string, number> = {};
  let totalWeight = 0;

  for (const ballot of ballots) {
    const w = weights[ballot.voter] ?? 1;
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
    return {
      variant: 'tie',
      choices: JSON.stringify(entries.filter(e => e[1] === topWeight).map(e => e[0])),
      totalWeight,
    };
  }

  if (voteShare > threshold) {
    return { variant: 'winner', choice: topChoice, voteShare, totalWeight };
  }
  return { variant: 'no_majority', topChoice, voteShare, threshold, totalWeight };
}

type Result = { variant: string; [key: string]: unknown };

const _majorityCountHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const thr = typeof input.threshold === 'string' ? parseFloat(input.threshold as string) : input.threshold as number;
    if (thr !== undefined && thr !== null && thr < 0){return complete(createProgram(), 'error', { message: 'threshold must be non-negative' }) as StorageProgram<Result>;}
    const id = `maj-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'majority', id, {
      id,
      threshold: input.threshold ?? 0.5,
      binaryOnly: input.binaryOnly ?? true,
      tieBreaker: input.tieBreaker ?? null,
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'Majority',
      instanceId: id,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, ballots, weights } = input;
    let p = createProgram();
    p = get(p, 'majority', config as string, 'cfg');

    return completeFrom(p, '_dynamic', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const threshold = cfg ? (cfg.threshold as number) : 0.5;
      const tieBreaker = cfg ? (cfg.tieBreaker as string | null) : null;

      const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots as string) : ballots) as
        Array<{ voter: string; choice: string }>;
      const weightMap = (typeof weights === 'string' ? JSON.parse(weights as string) : weights ?? {}) as
        Record<string, number>;

      return tallyBallots(ballotList, weightMap, threshold, tieBreaker);
    }) as StorageProgram<Result>;
  },
};

export const majorityCountHandler = autoInterpret(_majorityCountHandler);
