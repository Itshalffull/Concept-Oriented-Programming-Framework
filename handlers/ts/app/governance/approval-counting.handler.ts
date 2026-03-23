// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ApprovalCounting Method Provider
// Each voter approves one or more candidates; candidates ranked by total approval weight.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function tallyApprovals(
  ballots: Array<{ voter: string; approvals: string[] }>,
  weightMap: Record<string, number>,
  winnerCount: number,
): { ranked: [string, number][]; winners: [string, number][]; topChoice: string | null; topApproval: number } {
  const tally: Record<string, number> = {};

  for (const ballot of ballots) {
    const w = weightMap[ballot.voter] ?? 1;
    for (const choice of ballot.approvals) {
      tally[choice] = (tally[choice] ?? 0) + w;
    }
  }

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const winners = ranked.slice(0, winnerCount);
  const topChoice = winners.length > 0 ? winners[0][0] : null;
  const topApproval = winners.length > 0 ? winners[0][1] : 0;

  return { ranked, winners, topChoice, topApproval };
}

const _approvalCountingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    if (!input.maxApprovals || (typeof input.maxApprovals === 'string' && (input.maxApprovals as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'maxApprovals is required' }) as StorageProgram<Result>;
    }
    const id = `approval-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'approval', id, {
      id,
      maxApprovals: input.maxApprovals ?? null,
      winnerCount: input.winnerCount ?? 1,
    });

    p = put(p, 'plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'ApprovalCounting',
      instanceId: id,
    });

    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, ballots, weights } = input;
    let p = createProgram();
    p = get(p, 'approval', config as string, 'cfg');

    return completeFrom(p, 'winners', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const winnerCount = cfg ? (cfg.winnerCount as number) : 1;

      const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
        Array<{ voter: string; approvals: string[] }>;
      const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
        Record<string, number>;

      const { ranked, topChoice, topApproval } = tallyApprovals(ballotList, weightMap, winnerCount);

      return {
        variant: 'winners',
        rankedResults: JSON.stringify(ranked.map(([choice, score]) => ({ choice, approvalWeight: score }))),
        topChoice,
        approvalCount: topApproval,
      };
    }) as StorageProgram<Result>;
  },
};

export const approvalCountingHandler = autoInterpret(_approvalCountingHandler);
