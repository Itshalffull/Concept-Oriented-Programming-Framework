// @clef-handler style=functional
// ApprovalCounting Concept Implementation
// Allows each voter to approve any number of candidates; the most-approved wins.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `approval-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ApprovalCounting' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const maxApprovals = input.maxApprovals as number | null | undefined;
    const winnerCount = input.winnerCount as number;

    if (winnerCount === undefined || winnerCount === null || winnerCount <= 0) {
      return complete(createProgram(), 'error', { message: 'winnerCount must be greater than zero' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'approval_config', id, {
      id,
      maxApprovals: maxApprovals ?? null,
      winnerCount,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const configId = input.config as string;
    const approvalSets = input.approvalSets as string;
    const weights = input.weights as string;

    if (!configId) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'approval_config', configId, 'configRecord');

    return branch(
      p,
      (b) => !b.configRecord,
      complete(createProgram(), 'error', { message: 'Approval counting config not found' }),
      (() => {
        let parsedSets: Array<{ voter: string; approvals: string[] }>;
        let parsedWeights: Record<string, number>;
        try {
          parsedSets = JSON.parse(approvalSets);
          parsedWeights = JSON.parse(weights || '{}');
        } catch {
          return complete(createProgram(), 'error', { message: 'Invalid JSON in approvalSets or weights' }) as StorageProgram<Result>;
        }

        if (!Array.isArray(parsedSets) || parsedSets.length === 0) {
          return complete(createProgram(), 'error', { message: 'No ballots provided' }) as StorageProgram<Result>;
        }

        // Count approvals per candidate
        const counts: Record<string, number> = {};
        for (const ballot of parsedSets) {
          const weight = parsedWeights[ballot.voter] ?? 1.0;
          for (const candidate of (ballot.approvals || [])) {
            counts[candidate] = (counts[candidate] || 0) + weight;
          }
        }

        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (ranked.length === 0) {
          return complete(createProgram(), 'error', { message: 'No candidates in ballots' }) as StorageProgram<Result>;
        }

        const topScore = ranked[0][1];
        const tied = ranked.filter(([, score]) => score === topScore);

        if (tied.length > 1) {
          return complete(createProgram(), 'ok', {
            tiedCandidates: JSON.stringify(tied.map(([c]) => c)),
            approvalCount: topScore,
          }) as StorageProgram<Result>;
        }

        return complete(createProgram(), 'ok', {
          rankedResults: JSON.stringify(ranked),
          topChoice: ranked[0][0],
          approvalCount: topScore,
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const approvalCountingHandler = autoInterpret(_handler);
