// Vote Concept Handler
// Session-based voting with weighted ballot collection and tallying.
import type { ConceptHandler } from '@clef/runtime';

export const voteHandler: ConceptHandler = {
  async openSession(input, storage) {
    const id = `session-${Date.now()}`;
    await storage.put('session', id, {
      id, proposalRef: input.proposalRef, deadline: input.deadline,
      snapshotRef: input.snapshotRef, status: 'Open', ballots: [], createdAt: new Date().toISOString(),
    });
    return { variant: 'opened', session: id };
  },

  async castVote(input, storage) {
    const { session, voter, choice, weight } = input;
    const record = await storage.get('session', session as string);
    if (!record) return { variant: 'session_not_found', session };
    if (record.status !== 'Open') return { variant: 'closed', session };
    const ballots = record.ballots as Array<{ voter: unknown; choice: unknown; weight: unknown }>;
    if (ballots.some(b => b.voter === voter)) return { variant: 'already_voted', voter };
    ballots.push({ voter, choice, weight });
    await storage.put('session', session as string, { ...record, ballots });
    return { variant: 'cast', ballot: `${session}:${voter}` };
  },

  async close(input, storage) {
    const { session } = input;
    const record = await storage.get('session', session as string);
    if (!record) return { variant: 'not_found', session };
    await storage.put('session', session as string, { ...record, status: 'Closed' });
    return { variant: 'closed', session };
  },

  async tally(input, storage) {
    const { session } = input;
    const record = await storage.get('session', session as string);
    if (!record) return { variant: 'not_found', session };
    const ballots = record.ballots as Array<{ choice: string; weight: number }>;
    const totals: Record<string, number> = {};
    for (const b of ballots) {
      totals[b.choice] = (totals[b.choice] ?? 0) + (b.weight ?? 1);
    }
    const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    const outcome = winner ? winner[0] : 'no_result';
    await storage.put('session', session as string, { ...record, status: 'Tallied', outcome, totals });
    return { variant: 'result', session, outcome, totals: JSON.stringify(totals) };
  },
};
