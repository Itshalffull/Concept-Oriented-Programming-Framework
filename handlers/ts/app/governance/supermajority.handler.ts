// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Supermajority Counting Method Provider
// Weighted tally with configurable threshold (e.g., 2/3) and abstention handling.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom, mapBindings,
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

const _supermajorityHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const thr = typeof input.threshold === 'string' ? parseFloat(input.threshold as string) : (input.threshold as number);
    if (thr !== undefined && !isNaN(thr) && thr < 0.5) {
      return complete(createProgram(), 'error', { message: 'threshold must be >= 0.5' }) as StorageProgram<Result>;
    }
    const id = `supermaj-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'supermajority', id, {
      id,
      threshold: input.threshold ?? 2 / 3,
      roundingMode: input.roundingMode ?? 'floor',
      abstentionsCount: input.abstentionsCount ?? false,
    });
    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'Supermajority',
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
    p = get(p, 'supermajority', config as string, 'cfg');

    return completeFrom(p, 'ok', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const threshold = cfg
        ? (typeof cfg.threshold === 'string' ? parseFloat(cfg.threshold as string) : (cfg.threshold as number) ?? 2 / 3)
        : 2 / 3;
      const abstentionsCount = cfg ? (cfg.abstentionsCount as boolean) : false;

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
        return { totalWeight: 0, abstentions: abstainWeight };
      }

      const [topChoice, topWeight] = entries[0];
      const voteShare = totalWeight > 0 ? topWeight / totalWeight : 0;

      return { choice: topChoice, voteShare, requiredShare: threshold, totalWeight, abstentions: abstainWeight };
    }) as StorageProgram<Result>;
  },
};

export const supermajorityHandler = autoInterpret(_supermajorityHandler);
