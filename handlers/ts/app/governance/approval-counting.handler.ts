// ApprovalCounting Method Provider
// Each voter approves one or more candidates; candidates ranked by total approval weight.
import type { ConceptHandler } from '@clef/runtime';

export const approvalCountingHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `approval-${Date.now()}`;
    await storage.put('approval', id, {
      id,
      maxApprovals: input.maxApprovals ?? null,
      winnerCount: input.winnerCount ?? 1,
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'ApprovalCounting',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async count(input, storage) {
    const { config, ballots, weights } = input;
    const cfg = await storage.get('approval', config as string);
    const winnerCount = cfg ? (cfg.winnerCount as number) : 1;

    const ballotList = (typeof ballots === 'string' ? JSON.parse(ballots) : ballots) as
      Array<{ voter: string; approvals: string[] }>;
    const weightMap = (typeof weights === 'string' ? JSON.parse(weights) : weights ?? {}) as
      Record<string, number>;

    const tally: Record<string, number> = {};

    for (const ballot of ballotList) {
      const w = weightMap[ballot.voter] ?? 1;
      for (const choice of ballot.approvals) {
        tally[choice] = (tally[choice] ?? 0) + w;
      }
    }

    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const winners = ranked.slice(0, winnerCount);
    const topChoice = winners.length > 0 ? winners[0][0] : null;
    const topApproval = winners.length > 0 ? winners[0][1] : 0;

    return {
      variant: 'winners',
      rankedResults: JSON.stringify(ranked.map(([choice, score]) => ({ choice, approvalWeight: score }))),
      topChoice,
      approvalCount: topApproval,
    };
  },
};
