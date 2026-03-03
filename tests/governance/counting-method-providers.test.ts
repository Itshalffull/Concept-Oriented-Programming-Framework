// ============================================================
// Counting Method Provider Conformance Tests
//
// Tests for all 9 counting method providers: Majority, Supermajority,
// ApprovalCounting, ScoreVoting, BordaCount, RankedChoice,
// QuadraticVoting, CondorcetSchulze, and ConsentProcess.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { majorityCountHandler } from '../../handlers/ts/app/governance/majority.handler.js';
import { supermajorityHandler } from '../../handlers/ts/app/governance/supermajority.handler.js';
import { approvalCountingHandler } from '../../handlers/ts/app/governance/approval-counting.handler.js';
import { scoreVotingHandler } from '../../handlers/ts/app/governance/score-voting.handler.js';
import { bordaCountHandler } from '../../handlers/ts/app/governance/borda-count.handler.js';
import { rankedChoiceHandler } from '../../handlers/ts/app/governance/ranked-choice.handler.js';
import { quadraticVotingHandler } from '../../handlers/ts/app/governance/quadratic-voting.handler.js';
import { condorcetSchulzeHandler } from '../../handlers/ts/app/governance/condorcet-schulze.handler.js';
import { consentProcessHandler } from '../../handlers/ts/app/governance/consent-process.handler.js';

describe('Counting Method Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ────────────────────────────────────────────────
  //  Majority
  // ────────────────────────────────────────────────
  describe('Majority', () => {
    it('configures with default threshold', async () => {
      const result = await majorityCountHandler.configure({}, storage);
      expect(result.variant).toBe('configured');
      expect(result.config).toBeDefined();
    });

    it('determines winner with clear majority', async () => {
      const cfg = await majorityCountHandler.configure({ threshold: 0.5 }, storage);
      const result = await majorityCountHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'alice', choice: 'yes' },
          { voter: 'bob', choice: 'yes' },
          { voter: 'charlie', choice: 'no' },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.choice).toBe('yes');
      expect(result.voteShare).toBeCloseTo(2 / 3, 5);
    });

    it('respects voter weights', async () => {
      const cfg = await majorityCountHandler.configure({ threshold: 0.5 }, storage);
      const result = await majorityCountHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'alice', choice: 'yes' },
          { voter: 'bob', choice: 'no' },
        ],
        weights: { alice: 3, bob: 1 },
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.choice).toBe('yes');
      expect(result.voteShare).toBeCloseTo(0.75, 5);
    });

    it('detects a tie', async () => {
      const cfg = await majorityCountHandler.configure({}, storage);
      const result = await majorityCountHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'alice', choice: 'yes' },
          { voter: 'bob', choice: 'no' },
        ],
      }, storage);
      expect(result.variant).toBe('tie');
    });

    it('returns no_majority when threshold not met', async () => {
      const cfg = await majorityCountHandler.configure({ threshold: 0.75 }, storage);
      const result = await majorityCountHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'alice', choice: 'yes' },
          { voter: 'bob', choice: 'yes' },
          { voter: 'charlie', choice: 'yes' },
          { voter: 'dave', choice: 'no' },
          { voter: 'eve', choice: 'no' },
        ],
      }, storage);
      // 3/5 = 0.6 which is > 0.5 threshold but not > 0.75
      expect(result.variant).toBe('no_majority');
    });
  });

  // ────────────────────────────────────────────────
  //  Supermajority
  // ────────────────────────────────────────────────
  describe('Supermajority', () => {
    it('achieves supermajority at 2/3 threshold', async () => {
      const cfg = await supermajorityHandler.configure({ threshold: 2 / 3 }, storage);
      const result = await supermajorityHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', choice: 'yes' },
          { voter: 'b', choice: 'yes' },
          { voter: 'c', choice: 'no' },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.choice).toBe('yes');
    });

    it('fails supermajority when votes are close', async () => {
      const cfg = await supermajorityHandler.configure({ threshold: 2 / 3 }, storage);
      const result = await supermajorityHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', choice: 'yes' },
          { voter: 'b', choice: 'yes' },
          { voter: 'c', choice: 'no' },
          { voter: 'd', choice: 'no' },
        ],
      }, storage);
      expect(result.variant).toBe('no_supermajority');
    });

    it('handles abstentions correctly', async () => {
      const cfg = await supermajorityHandler.configure({ threshold: 2 / 3, abstentionsCount: true }, storage);
      const result = await supermajorityHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', choice: 'yes' },
          { voter: 'b', choice: 'yes' },
          { voter: 'c', choice: 'abstain' },
        ],
      }, storage);
      // With abstentions counted in total: yes=2 out of total=3, share=0.667
      expect(result.variant).toBe('winner');
      expect(result.abstentions).toBe(1);
    });
  });

  // ────────────────────────────────────────────────
  //  ApprovalCounting
  // ────────────────────────────────────────────────
  describe('ApprovalCounting', () => {
    it('ranks candidates by approval count', async () => {
      const cfg = await approvalCountingHandler.configure({ winnerCount: 2 }, storage);
      const result = await approvalCountingHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', approvals: ['X', 'Y'] },
          { voter: 'b', approvals: ['X', 'Z'] },
          { voter: 'c', approvals: ['Y', 'Z'] },
        ],
      }, storage);
      expect(result.variant).toBe('winners');
      expect(result.topChoice).toBeDefined();
      const ranked = JSON.parse(result.rankedResults as string);
      expect(ranked.length).toBe(3);
    });

    it('applies weights to approval tallies', async () => {
      const cfg = await approvalCountingHandler.configure({}, storage);
      const result = await approvalCountingHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', approvals: ['X'] },
          { voter: 'b', approvals: ['Y'] },
        ],
        weights: { a: 10, b: 1 },
      }, storage);
      expect(result.variant).toBe('winners');
      expect(result.topChoice).toBe('X');
    });
  });

  // ────────────────────────────────────────────────
  //  ScoreVoting
  // ────────────────────────────────────────────────
  describe('ScoreVoting', () => {
    it('determines winner by weighted mean', async () => {
      const cfg = await scoreVotingHandler.configure({ aggregation: 'Mean' }, storage);
      const result = await scoreVotingHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', scores: { X: 5, Y: 3 } },
          { voter: 'b', scores: { X: 4, Y: 5 } },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.choice).toBe('X'); // mean: X=4.5 Y=4
      expect(result.averageScore).toBeCloseTo(4.5, 5);
    });

    it('uses median aggregation', async () => {
      const cfg = await scoreVotingHandler.configure({ aggregation: 'Median' }, storage);
      const result = await scoreVotingHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', scores: { X: 1 } },
          { voter: 'b', scores: { X: 5 } },
          { voter: 'c', scores: { X: 9 } },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.averageScore).toBe(5); // median of [1,5,9]
    });
  });

  // ────────────────────────────────────────────────
  //  BordaCount
  // ────────────────────────────────────────────────
  describe('BordaCount', () => {
    it('uses Standard scoring (n-1-i points)', async () => {
      const cfg = await bordaCountHandler.configure({ scheme: 'Standard' }, storage);
      const result = await bordaCountHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', ranking: ['X', 'Y', 'Z'] },
          { voter: 'b', ranking: ['X', 'Z', 'Y'] },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.choice).toBe('X'); // X gets 2+2=4, Y gets 1+0=1, Z gets 0+1=1
    });

    it('uses Dowdall scoring (1/(i+1) points)', async () => {
      const cfg = await bordaCountHandler.configure({ scheme: 'Dowdall' }, storage);
      const result = await bordaCountHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', ranking: ['X', 'Y', 'Z'] },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      const scores = JSON.parse(result.scores as string);
      expect(scores.X).toBeCloseTo(1, 5);       // 1/1
      expect(scores.Y).toBeCloseTo(0.5, 5);     // 1/2
    });
  });

  // ────────────────────────────────────────────────
  //  RankedChoice (IRV)
  // ────────────────────────────────────────────────
  describe('RankedChoice', () => {
    it('elects a candidate with immediate majority', async () => {
      const cfg = await rankedChoiceHandler.configure({}, storage);
      const result = await rankedChoiceHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', ranking: ['X', 'Y'] },
          { voter: 'b', ranking: ['X', 'Z'] },
          { voter: 'c', ranking: ['Y', 'X'] },
        ],
      }, storage);
      expect(result.variant).toBe('elected');
      const winners = JSON.parse(result.winners as string);
      expect(winners).toContain('X');
    });

    it('eliminates and redistributes in multi-round', async () => {
      const cfg = await rankedChoiceHandler.configure({}, storage);
      const result = await rankedChoiceHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', ranking: ['A', 'B', 'C'] },
          { voter: 'b', ranking: ['B', 'C', 'A'] },
          { voter: 'c', ranking: ['C', 'B', 'A'] },
          { voter: 'd', ranking: ['C', 'A', 'B'] },
          { voter: 'e', ranking: ['A', 'C', 'B'] },
        ],
      }, storage);
      expect(result.variant).toBe('elected');
      const rounds = JSON.parse(result.rounds as string);
      expect(rounds.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ────────────────────────────────────────────────
  //  QuadraticVoting
  // ────────────────────────────────────────────────
  describe('QuadraticVoting', () => {
    it('opens a session and casts votes within budget', async () => {
      const session = await quadraticVotingHandler.openSession(
        { creditBudget: 100, options: ['A', 'B', 'C'] },
        storage,
      );
      expect(session.variant).toBe('opened');

      // 3 votes for A costs 9, 2 votes for B costs 4 → total 13 ≤ 100
      const cast = await quadraticVotingHandler.castVotes({
        session: session.session,
        voter: 'alice',
        allocations: { A: 3, B: 2 },
      }, storage);
      expect(cast.variant).toBe('cast');
      expect(cast.totalCost).toBe(13);
    });

    it('rejects votes exceeding credit budget', async () => {
      const session = await quadraticVotingHandler.openSession(
        { creditBudget: 10, options: ['A'] },
        storage,
      );
      const cast = await quadraticVotingHandler.castVotes({
        session: session.session,
        voter: 'alice',
        allocations: { A: 5 }, // cost = 25 > 10
      }, storage);
      expect(cast.variant).toBe('budget_exceeded');
    });

    it('tallies effective votes correctly', async () => {
      const session = await quadraticVotingHandler.openSession(
        { creditBudget: 100, options: ['A', 'B'] },
        storage,
      );

      await quadraticVotingHandler.castVotes({
        session: session.session,
        voter: 'alice',
        allocations: { A: 5, B: 2 },
      }, storage);
      await quadraticVotingHandler.castVotes({
        session: session.session,
        voter: 'bob',
        allocations: { A: 1, B: 4 },
      }, storage);

      const tally = await quadraticVotingHandler.tally({ session: session.session }, storage);
      expect(tally.variant).toBe('result');
      const votesByOption = JSON.parse(tally.votesByOption as string);
      expect(votesByOption.A).toBe(6); // 5 + 1
      expect(votesByOption.B).toBe(6); // 2 + 4
    });
  });

  // ────────────────────────────────────────────────
  //  CondorcetSchulze
  // ────────────────────────────────────────────────
  describe('CondorcetSchulze', () => {
    it('finds a Condorcet winner', async () => {
      const cfg = await condorcetSchulzeHandler.configure({}, storage);
      const result = await condorcetSchulzeHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', ranking: ['A', 'B', 'C'] },
          { voter: 'b', ranking: ['A', 'C', 'B'] },
          { voter: 'c', ranking: ['A', 'B', 'C'] },
        ],
      }, storage);
      expect(result.variant).toBe('winner');
      expect(result.choice).toBe('A');
    });

    it('handles no clear Condorcet winner', async () => {
      const cfg = await condorcetSchulzeHandler.configure({}, storage);
      // Rock-paper-scissors cycle: A>B, B>C, C>A
      const result = await condorcetSchulzeHandler.count({
        config: cfg.config,
        ballots: [
          { voter: 'a', ranking: ['A', 'B', 'C'] },
          { voter: 'b', ranking: ['B', 'C', 'A'] },
          { voter: 'c', ranking: ['C', 'A', 'B'] },
        ],
      }, storage);
      // Schulze should still produce a result (winner or no_condorcet_winner)
      expect(['winner', 'no_condorcet_winner']).toContain(result.variant);
      expect(result.pairwiseMatrix).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────
  //  ConsentProcess
  // ────────────────────────────────────────────────
  describe('ConsentProcess', () => {
    it('opens a round and advances through phases', async () => {
      const round = await consentProcessHandler.openRound(
        { proposal: 'Budget allocation', facilitator: 'alice' },
        storage,
      );
      expect(round.variant).toBe('opened');

      const phase1 = await consentProcessHandler.advancePhase({ round: round.round }, storage);
      expect(phase1.variant).toBe('advanced');
      expect(phase1.phase).toBe('Clarifying');

      const phase2 = await consentProcessHandler.advancePhase({ round: round.round }, storage);
      expect(phase2.variant).toBe('advanced');
      expect(phase2.phase).toBe('Reacting');
    });

    it('raises and resolves objections', async () => {
      const round = await consentProcessHandler.openRound(
        { proposal: 'New policy', facilitator: 'alice' },
        storage,
      );
      // Advance to Reacting phase
      await consentProcessHandler.advancePhase({ round: round.round }, storage);
      await consentProcessHandler.advancePhase({ round: round.round }, storage);

      const obj = await consentProcessHandler.raiseObjection({
        round: round.round,
        raiser: 'bob',
        objection: 'This conflicts with existing bylaws',
      }, storage);
      expect(obj.variant).toBe('objection_raised');

      const resolve = await consentProcessHandler.resolveObjection({
        round: round.round,
        objection: obj.objectionId,
        resolution: 'Added exception clause',
      }, storage);
      expect(resolve.variant).toBe('objection_resolved');
    });

    it('blocks advancing with unresolved objections', async () => {
      const round = await consentProcessHandler.openRound(
        { proposal: 'Test', facilitator: 'alice' },
        storage,
      );
      // Advance to Reacting
      await consentProcessHandler.advancePhase({ round: round.round }, storage);
      await consentProcessHandler.advancePhase({ round: round.round }, storage);

      await consentProcessHandler.raiseObjection({
        round: round.round,
        raiser: 'bob',
        objection: 'Disagree',
      }, storage);

      // Try to advance past Objecting with unresolved objection
      const blocked = await consentProcessHandler.advancePhase({ round: round.round }, storage);
      expect(blocked.variant).toBe('unresolved_objections');
    });

    it('finalizes when all objections resolved', async () => {
      const round = await consentProcessHandler.openRound(
        { proposal: 'Final test', facilitator: 'alice' },
        storage,
      );
      const finalize = await consentProcessHandler.finalize({ round: round.round }, storage);
      expect(finalize.variant).toBe('consented');
    });
  });
});
