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

function parseBallots(raw: unknown): Array<{ voter: string; approvals: string[] }> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (Array.isArray(raw)) return raw as Array<{ voter: string; approvals: string[] }>;
  return null;
}

const _approvalCountingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    // maxApprovals: null means unlimited (valid), only error if it's missing entirely (undefined)
    if (input.maxApprovals === undefined) {
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

    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  count(input: Record<string, unknown>) {
    const { config, weights } = input;
    // Support both 'approvalSets' (spec field) and 'ballots' (legacy)
    const rawBallots = input.approvalSets ?? input.ballots;

    const ballotList = parseBallots(rawBallots);

    if (!ballotList || ballotList.length === 0) {
      return complete(createProgram(), 'error', { message: 'ballots are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'approval', config as string, 'cfg');

    return completeFrom(p, 'ok', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const winnerCount = cfg ? ((typeof cfg.winnerCount === 'string' ? parseInt(cfg.winnerCount as string) : cfg.winnerCount as number) ?? 1) : 1;

      const weightMap = (typeof weights === 'string' ? (() => { try { return JSON.parse(weights as string); } catch { return {}; } })() : weights ?? {}) as
        Record<string, number>;

      const { ranked, topChoice, topApproval } = tallyApprovals(ballotList, weightMap, winnerCount);

      return {
        rankedResults: JSON.stringify(ranked.map(([choice, score]) => ({ choice, approvalWeight: score }))),
        topChoice,
        approvalCount: topApproval,
      };
    }) as StorageProgram<Result>;
  },
};

export const approvalCountingHandler = autoInterpret(_approvalCountingHandler);
