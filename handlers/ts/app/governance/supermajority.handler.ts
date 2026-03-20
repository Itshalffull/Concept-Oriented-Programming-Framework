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

const _supermajorityHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
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
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, ballots, weights } = input;
    let p = createProgram();
    p = get(p, 'supermajority', config as string, 'cfg');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const threshold = cfg ? (cfg.threshold as number) : 2 / 3;
      const abstentionsCount = cfg ? (cfg.abstentionsCount as boolean) : false;

      const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots as string) : ballots) as
        Array<{ voter: string; choice: string }>;
      const weightMap = (typeof weights === 'string' ? JSON.parse(weights as string) : weights ?? {}) as
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
    }, 'countResult');

    return completeFrom(p, 'winner', (bindings) => {
      return bindings.countResult as Record<string, unknown>;
    }) as StorageProgram<Result>;
  },
};

export const supermajorityHandler = autoInterpret(_supermajorityHandler);
