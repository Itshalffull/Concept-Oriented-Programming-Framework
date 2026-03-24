// @clef-handler style=functional
// Supermajority Concept Implementation
// Requires a heightened threshold of support beyond simple majority.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `supermajority-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Supermajority' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const threshold = input.threshold as number;
    const roundingMode = input.roundingMode as string;
    const abstentionsCount = input.abstentionsCount as boolean;

    if (threshold === undefined || threshold === null) {
      return complete(createProgram(), 'error', { message: 'threshold is required' }) as StorageProgram<Result>;
    }
    if (threshold <= 0.5 || threshold > 1.0) {
      return complete(createProgram(), 'error', { message: 'threshold must be between 0.5 (exclusive) and 1.0 (inclusive)' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'supermajority_config', id, {
      id,
      threshold,
      roundingMode: roundingMode || 'Floor',
      abstentionsCount: abstentionsCount ?? false,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const configId = input.config as string;
    const ballots = input.ballots as string;
    const weights = input.weights as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'supermajority_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Supermajority config not found' }),
      (() => {
        let parsedBallots: Array<{ voter: string; choice: string }>;
        let parsedWeights: Record<string, number>;
        try {
          parsedBallots = JSON.parse(ballots);
          parsedWeights = JSON.parse(weights || '{}');
        } catch {
          return complete(createProgram(), 'error', { message: 'Invalid JSON in ballots or weights' }) as StorageProgram<Result>;
        }

        if (!Array.isArray(parsedBallots) || parsedBallots.length === 0) {
          return complete(createProgram(), 'error', { message: 'No ballots provided' }) as StorageProgram<Result>;
        }

        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.configRecord as Record<string, unknown>;
          return {
            threshold: rec.threshold as number,
            abstentionsCount: rec.abstentionsCount as boolean,
          };
        }, '_config');

        return completeFrom(b2, 'ok', (b) => {
          const cfg = b._config as { threshold: number; abstentionsCount: boolean };
          const voteCounts: Record<string, number> = {};
          let totalCast = 0;
          let totalAbstain = 0;

          for (const ballot of parsedBallots) {
            const weight = parsedWeights[ballot.voter] ?? 1.0;
            if (ballot.choice === 'abstain') {
              totalAbstain += weight;
            } else {
              voteCounts[ballot.choice] = (voteCounts[ballot.choice] || 0) + weight;
              totalCast += weight;
            }
          }

          const denominator = cfg.abstentionsCount ? totalCast + totalAbstain : totalCast;
          if (denominator === 0) {
            return { leadingChoice: 'none', voteShare: 0, requiredShare: cfg.threshold, shortfall: cfg.threshold };
          }

          const ranked = Object.entries(voteCounts).sort((a, c) => c[1] - a[1]);
          if (ranked.length === 0) {
            return { leadingChoice: 'none', voteShare: 0, requiredShare: cfg.threshold, shortfall: cfg.threshold };
          }

          const topShare = ranked[0][1] / denominator;
          if (topShare >= cfg.threshold) {
            return {
              choice: ranked[0][0],
              voteShare: topShare,
              requiredShare: cfg.threshold,
            };
          }

          return {
            leadingChoice: ranked[0][0],
            voteShare: topShare,
            requiredShare: cfg.threshold,
            shortfall: cfg.threshold - topShare,
          };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const supermajorityHandler = autoInterpret(_handler);
