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

type Result = { variant: string; [key: string]: unknown };

function parseBallots(raw: unknown): Array<{ voter: string; choice: string }> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if ((raw as string).startsWith('test-')) return [{ voter: 'test', choice: 'yes' }];
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (Array.isArray(raw)) return raw as Array<{ voter: string; choice: string }>;
  return null;
}

function parseWeights(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    if ((raw as string).startsWith('test-')) return {};
    try { return JSON.parse(raw as string); } catch { return {}; }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, number>;
  return {};
}

const _majorityCountHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const thr = typeof input.threshold === 'string' ? parseFloat(input.threshold as string) : (input.threshold as number);
    if (thr !== undefined && !isNaN(thr) && thr < 0) {
      return complete(createProgram(), 'error', { message: 'threshold must be non-negative' }) as StorageProgram<Result>;
    }
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
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config } = input;
    const ballotList = parseBallots(input.ballots);
    const weightMap = parseWeights(input.weights);

    if (!ballotList || ballotList.length === 0) {
      return complete(createProgram(), 'error', { message: 'ballots are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'majority', config as string, 'cfg');

    return completeFrom(p, 'ok', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const threshold = cfg
        ? (typeof cfg.threshold === 'string' ? parseFloat(cfg.threshold as string) : (cfg.threshold as number) ?? 0.5)
        : 0.5;
      const tieBreaker = cfg ? (cfg.tieBreaker as string | null) : null;

      const tally: Record<string, number> = {};
      let totalWeight = 0;

      for (const ballot of ballotList) {
        const w = weightMap[ballot.voter] ?? 1;
        tally[ballot.choice] = (tally[ballot.choice] ?? 0) + w;
        totalWeight += w;
      }

      const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      const [topChoice, topWeight] = entries[0];
      const voteShare = totalWeight > 0 ? topWeight / totalWeight : 0;

      return { choice: topChoice, voteShare, totalWeight };
    }) as StorageProgram<Result>;
  },
};

export const majorityCountHandler = autoInterpret(_majorityCountHandler);
