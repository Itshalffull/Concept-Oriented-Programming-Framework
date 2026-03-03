// QuadraticVoting Counting Method Provider
// Credit-based voting: cost = votes², voters allocate from a fixed credit budget.
import type { ConceptHandler } from '@clef/runtime';

export const quadraticVotingHandler: ConceptHandler = {
  async openSession(input, storage) {
    const id = `qv-${Date.now()}`;
    await storage.put('qv_session', id, {
      id,
      creditBudget: input.creditBudget as number,
      options: input.options,
      status: 'open',
    });

    await storage.put('plugin-registry', `counting-method:${id}`, {
      id: `counting-method:${id}`,
      pluginKind: 'counting-method',
      provider: 'QuadraticVoting',
      instanceId: id,
    });

    return { variant: 'opened', session: id };
  },

  async castVotes(input, storage) {
    const { session, voter, allocations } = input;
    const record = await storage.get('qv_session', session as string);
    if (!record) return { variant: 'not_found', session };
    if (record.status !== 'open') return { variant: 'session_closed', session };

    const budget = record.creditBudget as number;
    const allocs = (typeof allocations === 'string' ? JSON.parse(allocations) : allocations) as
      Record<string, number>;

    // Calculate total cost: sum of votes² for each option
    let totalCost = 0;
    for (const votes of Object.values(allocs)) {
      totalCost += votes * votes;
    }

    if (totalCost > budget) {
      return { variant: 'budget_exceeded', totalCost, budget };
    }

    const voteKey = `${session}:${voter}`;
    await storage.put('qv_vote', voteKey, {
      session,
      voter,
      allocations: allocs,
      totalCost,
      castAt: new Date().toISOString(),
    });

    return { variant: 'cast', session, totalCost, remainingCredits: budget - totalCost };
  },

  async tally(input, storage) {
    const { session } = input;
    const record = await storage.get('qv_session', session as string);
    if (!record) return { variant: 'not_found', session };

    const allVotes = await storage.find('qv_vote', { session: session as string });

    const votesByOption: Record<string, number> = {};
    for (const vote of allVotes) {
      const allocs = vote.allocations as Record<string, number>;
      for (const [option, votes] of Object.entries(allocs)) {
        votesByOption[option] = (votesByOption[option] ?? 0) + votes;
      }
    }

    const ranked = Object.entries(votesByOption).sort((a, b) => b[1] - a[1]);
    const winner = ranked.length > 0 ? ranked[0][0] : null;

    await storage.put('qv_session', session as string, { ...record, status: 'tallied' });

    return {
      variant: 'result',
      session,
      winner,
      votesByOption: JSON.stringify(votesByOption),
    };
  },
};
