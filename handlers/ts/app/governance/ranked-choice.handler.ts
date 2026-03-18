// @migrated dsl-constructs 2026-03-18
// RankedChoice (IRV) Counting Method Provider
// Instant Runoff Voting: iteratively eliminates the lowest candidate and redistributes ballots.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, mapBindings, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _rankedChoiceHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `rcv-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'rcv', id, {
      id,
      seats: input.seats ?? 1,
      method: input.method ?? 'IRV',
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'RankedChoice',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { ballots, weights } = input;
    let p = createProgram();

    p = mapBindings(p, () => {
      const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots as string) : ballots) as
        Array<{ voter: string; ranking: string[] }>;
      const weightMap = (typeof weights === 'string' ? JSON.parse(weights as string) : weights ?? {}) as
        Record<string, number>;

      const activeBallots = ballotList.map(b => ({
        ranking: [...b.ranking],
        weight: weightMap[b.voter] ?? 1,
      }));

      const eliminated = new Set<string>();
      const rounds: Array<{ round: number; tally: Record<string, number>; eliminated: string | null }> = [];
      const totalWeight = activeBallots.reduce((s, b) => s + b.weight, 0);
      const majority = totalWeight / 2;

      for (let round = 1; round <= 100; round++) {
        const tally: Record<string, number> = {};
        for (const ballot of activeBallots) {
          const top = ballot.ranking.find(c => !eliminated.has(c));
          if (top) {
            tally[top] = (tally[top] ?? 0) + ballot.weight;
          }
        }

        const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) break;

        if (entries[0][1] > majority) {
          rounds.push({ round, tally, eliminated: null });
          return {
            variant: 'elected',
            winners: JSON.stringify([entries[0][0]]),
            rounds: JSON.stringify(rounds),
          };
        }

        const lowest = entries[entries.length - 1][0];
        eliminated.add(lowest);
        rounds.push({ round, tally, eliminated: lowest });

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
    }, 'irvResult');

    return completeFrom(p, 'elected', (bindings) => {
      const result = bindings.irvResult as Record<string, unknown>;
      return result;
    }) as StorageProgram<Result>;
  },
};

export const rankedChoiceHandler = autoInterpret(_rankedChoiceHandler);
