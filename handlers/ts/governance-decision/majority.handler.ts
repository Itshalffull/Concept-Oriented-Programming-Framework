// @clef-handler style=functional
// Majority Concept Implementation
// Determines a winner by simple majority of weighted votes.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `majority-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Majority' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const threshold = input.threshold as number;
    const binaryOnly = input.binaryOnly as boolean;
    const tieBreaker = input.tieBreaker as string | null | undefined;

    if (threshold === undefined || threshold === null) {
      return complete(createProgram(), 'error', { message: 'threshold is required' }) as StorageProgram<Result>;
    }
    if (threshold < 0 || threshold > 1) {
      return complete(createProgram(), 'error', { message: 'threshold must be between 0 and 1' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'majority_config', id, {
      id,
      threshold,
      binaryOnly: binaryOnly ?? true,
      tieBreaker: tieBreaker ?? null,
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
    p = get(p, 'majority_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Majority config not found' }),
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
          return rec.threshold as number;
        }, '_threshold');

        return completeFrom(b2, 'ok', (b) => {
          const threshold = b._threshold as number;
          const voteCounts: Record<string, number> = {};
          let totalWeight = 0;

          for (const ballot of parsedBallots) {
            const weight = parsedWeights[ballot.voter] ?? 1.0;
            voteCounts[ballot.choice] = (voteCounts[ballot.choice] || 0) + weight;
            totalWeight += weight;
          }

          const ranked = Object.entries(voteCounts).sort((a, c) => c[1] - a[1]);
          const topScore = ranked[0][1];
          const topShare = topScore / totalWeight;

          if (topShare >= threshold) {
            const tied = ranked.filter(([, s]) => s === topScore);
            if (tied.length > 1) {
              return {
                choices: JSON.stringify(tied.map(([c]) => c)),
                voteShare: topShare,
              };
            }
            return {
              choice: ranked[0][0],
              voteShare: topShare,
              totalWeight,
            };
          }

          return {
            leadingChoice: ranked[0][0],
            voteShare: topShare,
            threshold,
          };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const majorityHandler = autoInterpret(_handler);
