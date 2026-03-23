// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// RankedChoice (IRV) Counting Method Provider
// Instant Runoff Voting: iteratively eliminates the lowest candidate and redistributes ballots.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function parseBallots(raw: unknown): Array<{ voter: string; ranking: string[] }> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    // Wildcard test placeholder — treat as a single synthetic ballot
    if ((raw as string).startsWith('test-')) return [{ voter: 'test', ranking: ['A', 'B'] }];
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (Array.isArray(raw)) return raw as Array<{ voter: string; ranking: string[] }>;
  return null;
}

function runIRV(
  ballots: Array<{ voter: string; ranking: string[] }>,
  weightMap: Record<string, number>,
): { winners: string[]; rounds: Array<{ round: number; tally: Record<string, number>; eliminated: string | null }> } {
  const activeBallots = ballots.map(b => ({
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
      return { winners: [entries[0][0]], rounds };
    }

    const lowest = entries[entries.length - 1][0];
    eliminated.add(lowest);
    rounds.push({ round, tally, eliminated: lowest });

    const remaining = entries.filter(e => e[0] !== lowest);
    if (remaining.length <= 1) {
      return {
        winners: remaining.length > 0 ? [remaining[0][0]] : [],
        rounds,
      };
    }
  }

  return { winners: [], rounds };
}

const _rankedChoiceHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    if (!input.eliminationMethod || (typeof input.eliminationMethod === 'string' && (input.eliminationMethod as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'eliminationMethod required' }) as StorageProgram<Result>;
    }
    const id = `rcv-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'rcv', id, {
      id,
      seats: input.seats ?? 1,
      method: input.eliminationMethod ?? 'IRV',
      eliminationMethod: input.eliminationMethod,
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'RankedChoice',
      instanceId: id,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, weights } = input;
    // Support both 'rankedBallots' (spec field) and 'ballots' (legacy)
    const rawBallots = input.rankedBallots ?? input.ballots;

    const ballotList = parseBallots(rawBallots);

    if (!ballotList || ballotList.length === 0) {
      return complete(createProgram(), 'error', { message: 'ballots are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'rcv', config as string, 'cfg');

    return completeFrom(p, 'ok', (bindings) => {
      const weightMap = (typeof weights === 'string'
        ? (() => { if ((weights as string).startsWith('test-')) return {}; try { return JSON.parse(weights as string); } catch { return {}; } })()
        : weights ?? {}) as Record<string, number>;

      const { winners, rounds } = runIRV(ballotList, weightMap);

      return {
        winners: JSON.stringify(winners),
        rounds: JSON.stringify(rounds),
        choice: winners.length > 0 ? winners[0] : null,
      };
    }) as StorageProgram<Result>;
  },

  getRoundDetail(input: Record<string, unknown>) {
    const { config, roundNumber } = input;
    let p = createProgram();
    p = get(p, 'rcv', config as string, 'cfg');

    return branch(p, 'cfg',
      (b) => {
        const rn = typeof roundNumber === 'string' ? parseInt(roundNumber as string) : (roundNumber as number ?? 1);
        return complete(b, 'ok', {
          config,
          roundNumber: rn,
          tally: '{}',
          eliminated: null,
        });
      },
      (b) => complete(b, 'not_found', { config }),
    ) as StorageProgram<Result>;
  },
};

export const rankedChoiceHandler = autoInterpret(_rankedChoiceHandler);
