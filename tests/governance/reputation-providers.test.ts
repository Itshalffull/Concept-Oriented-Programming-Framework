// ============================================================
// Reputation Provider Conformance Tests
//
// Tests for all 5 reputation providers: SimpleAccumulator,
// EloRating, PeerAllocation, PageRankReputation, and GlickoRating.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { simpleAccumulatorHandler } from '../../handlers/ts/app/governance/simple-accumulator.handler.js';
import { eloRatingHandler } from '../../handlers/ts/app/governance/elo-rating.handler.js';
import { peerAllocationHandler } from '../../handlers/ts/app/governance/peer-allocation.handler.js';
import { pageRankReputationHandler } from '../../handlers/ts/app/governance/pagerank-reputation.handler.js';
import { glickoRatingHandler } from '../../handlers/ts/app/governance/glicko-rating.handler.js';

describe('Reputation Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ────────────────────────────────────────────────
  //  SimpleAccumulator
  // ────────────────────────────────────────────────
  describe('SimpleAccumulator', () => {
    it('accumulates positive reputation', async () => {
      const cfg = await simpleAccumulatorHandler.configure({}, storage);
      const add1 = await simpleAccumulatorHandler.add(
        { config: cfg.config, participant: 'alice', amount: 10 },
        storage,
      );
      expect(add1.variant).toBe('added');
      expect(add1.newScore).toBe(10);

      const add2 = await simpleAccumulatorHandler.add(
        { config: cfg.config, participant: 'alice', amount: 5 },
        storage,
      );
      expect(add2.newScore).toBe(15);
    });

    it('respects cap', async () => {
      const cfg = await simpleAccumulatorHandler.configure({ cap: 20 }, storage);
      await simpleAccumulatorHandler.add(
        { config: cfg.config, participant: 'alice', amount: 15 },
        storage,
      );
      const add = await simpleAccumulatorHandler.add(
        { config: cfg.config, participant: 'alice', amount: 10 },
        storage,
      );
      expect(add.newScore).toBe(20); // Capped at 20
    });

    it('applies decay', async () => {
      const cfg = await simpleAccumulatorHandler.configure({ decayRate: 0.1 }, storage);
      await simpleAccumulatorHandler.add(
        { config: cfg.config, participant: 'alice', amount: 100 },
        storage,
      );
      const decay = await simpleAccumulatorHandler.applyDecay(
        { config: cfg.config, participant: 'alice' },
        storage,
      );
      expect(decay.variant).toBe('decayed');
      expect(decay.newScore).toBeCloseTo(90, 5);
      expect(decay.previousScore).toBe(100);
    });

    it('returns no_decay when decayRate is null', async () => {
      const cfg = await simpleAccumulatorHandler.configure({}, storage);
      await simpleAccumulatorHandler.add(
        { config: cfg.config, participant: 'alice', amount: 50 },
        storage,
      );
      const decay = await simpleAccumulatorHandler.applyDecay(
        { config: cfg.config, participant: 'alice' },
        storage,
      );
      expect(decay.variant).toBe('no_decay');
    });

    it('gets score for unknown participant as 0', async () => {
      const cfg = await simpleAccumulatorHandler.configure({}, storage);
      const score = await simpleAccumulatorHandler.getScore(
        { config: cfg.config, participant: 'nobody' },
        storage,
      );
      expect(score.variant).toBe('score');
      expect(score.score).toBe(0);
    });
  });

  // ────────────────────────────────────────────────
  //  EloRating
  // ────────────────────────────────────────────────
  describe('EloRating', () => {
    it('updates ratings after a match', async () => {
      const cfg = await eloRatingHandler.configure(
        { kFactor: 32, initialRating: 1500 },
        storage,
      );

      const result = await eloRatingHandler.recordOutcome({
        config: cfg.config,
        winner: 'alice',
        loser: 'bob',
      }, storage);
      expect(result.variant).toBe('updated');
      // Equal opponents: winner gets +K/2 = +16
      expect(result.winnerNewRating).toBeCloseTo(1516, 0);
      expect(result.loserNewRating).toBeCloseTo(1484, 0);
    });

    it('gives less points when stronger player wins', async () => {
      const cfg = await eloRatingHandler.configure(
        { kFactor: 32, initialRating: 1500 },
        storage,
      );

      // Give alice a much higher rating by winning several times
      await eloRatingHandler.recordOutcome({ config: cfg.config, winner: 'alice', loser: 'charlie' }, storage);
      await eloRatingHandler.recordOutcome({ config: cfg.config, winner: 'alice', loser: 'charlie' }, storage);
      await eloRatingHandler.recordOutcome({ config: cfg.config, winner: 'alice', loser: 'charlie' }, storage);

      const alice = await eloRatingHandler.getRating({ config: cfg.config, participant: 'alice' }, storage);
      const charlie = await eloRatingHandler.getRating({ config: cfg.config, participant: 'charlie' }, storage);
      expect(alice.value).toBeGreaterThan(charlie.value as number);
    });

    it('handles draws correctly', async () => {
      const cfg = await eloRatingHandler.configure(
        { kFactor: 32, initialRating: 1500 },
        storage,
      );

      const result = await eloRatingHandler.recordDraw({
        config: cfg.config,
        participantA: 'alice',
        participantB: 'bob',
      }, storage);
      expect(result.variant).toBe('updated');
      // Equal opponents draw: no rating change
      expect(result.aNewRating).toBeCloseTo(1500, 0);
      expect(result.bNewRating).toBeCloseTo(1500, 0);
    });

    it('retrieves rating for new participant', async () => {
      const cfg = await eloRatingHandler.configure(
        { initialRating: 1200 },
        storage,
      );
      const result = await eloRatingHandler.getRating(
        { config: cfg.config, participant: 'newbie' },
        storage,
      );
      expect(result.variant).toBe('rating');
      expect(result.value).toBe(1200);
      expect(result.gamesPlayed).toBe(0);
    });
  });

  // ────────────────────────────────────────────────
  //  PeerAllocation
  // ────────────────────────────────────────────────
  describe('PeerAllocation', () => {
    it('opens a round and allocates', async () => {
      const round = await peerAllocationHandler.openRound(
        { budget: 1000, deadlineDays: 7 },
        storage,
      );
      expect(round.variant).toBe('opened');

      const alloc = await peerAllocationHandler.allocate({
        round: round.round,
        allocator: 'alice',
        recipient: 'bob',
        amount: 50,
      }, storage);
      expect(alloc.variant).toBe('allocated');
    });

    it('prevents self-allocation', async () => {
      const round = await peerAllocationHandler.openRound(
        { budget: 1000, deadlineDays: 7 },
        storage,
      );
      const result = await peerAllocationHandler.allocate({
        round: round.round,
        allocator: 'alice',
        recipient: 'alice',
        amount: 50,
      }, storage);
      expect(result.variant).toBe('self_allocation');
    });

    it('finalizes and normalizes allocations', async () => {
      const round = await peerAllocationHandler.openRound(
        { budget: 100, deadlineDays: 1 },
        storage,
      );

      await peerAllocationHandler.allocate({ round: round.round, allocator: 'alice', recipient: 'bob', amount: 30 }, storage);
      await peerAllocationHandler.allocate({ round: round.round, allocator: 'alice', recipient: 'charlie', amount: 10 }, storage);
      await peerAllocationHandler.allocate({ round: round.round, allocator: 'bob', recipient: 'charlie', amount: 20 }, storage);

      const finalize = await peerAllocationHandler.finalize({ round: round.round }, storage);
      expect(finalize.variant).toBe('finalized');

      const results = JSON.parse(finalize.results as string);
      // Bob: 30 out of 60 → 50% of budget (50)
      // Charlie: 30 out of 60 → 50% of budget (50)
      expect(results.bob).toBeCloseTo(50, 0);
      expect(results.charlie).toBeCloseTo(50, 0);
    });
  });

  // ────────────────────────────────────────────────
  //  PageRankReputation
  // ────────────────────────────────────────────────
  describe('PageRankReputation', () => {
    it('computes PageRank for a simple graph', async () => {
      const cfg = await pageRankReputationHandler.configure(
        { dampingFactor: 0.85, iterations: 20 },
        storage,
      );

      // A → B, A → C, B → C
      await pageRankReputationHandler.addContribution({ config: cfg.config, from: 'A', to: 'B' }, storage);
      await pageRankReputationHandler.addContribution({ config: cfg.config, from: 'A', to: 'C' }, storage);
      await pageRankReputationHandler.addContribution({ config: cfg.config, from: 'B', to: 'C' }, storage);

      const result = await pageRankReputationHandler.compute({ config: cfg.config }, storage);
      expect(result.variant).toBe('computed');

      const scores = JSON.parse(result.scores as string);
      // C receives links from both A and B, should have highest score
      expect(scores.C).toBeGreaterThan(scores.A);
      expect(scores.C).toBeGreaterThan(scores.B);
    });

    it('retrieves individual score after compute', async () => {
      const cfg = await pageRankReputationHandler.configure(
        { dampingFactor: 0.85, iterations: 10 },
        storage,
      );
      await pageRankReputationHandler.addContribution({ config: cfg.config, from: 'X', to: 'Y' }, storage);
      await pageRankReputationHandler.compute({ config: cfg.config }, storage);

      const score = await pageRankReputationHandler.getScore(
        { config: cfg.config, participant: 'Y' },
        storage,
      );
      expect(score.variant).toBe('score');
      expect(score.pageRank).toBeGreaterThan(0);
    });

    it('returns 0 for unknown participant', async () => {
      const cfg = await pageRankReputationHandler.configure({}, storage);
      const score = await pageRankReputationHandler.getScore(
        { config: cfg.config, participant: 'ghost' },
        storage,
      );
      expect(score.pageRank).toBe(0);
    });
  });

  // ────────────────────────────────────────────────
  //  GlickoRating
  // ────────────────────────────────────────────────
  describe('GlickoRating', () => {
    it('updates rating and deviation after an outcome', async () => {
      const cfg = await glickoRatingHandler.configure(
        { initialRating: 1500, initialDeviation: 350, initialVolatility: 0.06 },
        storage,
      );

      const result = await glickoRatingHandler.recordOutcome({
        config: cfg.config,
        participant: 'alice',
        opponent: 'bob',
        outcome: 1.0, // win
      }, storage);
      expect(result.variant).toBe('updated');
      expect(result.newRating).toBeGreaterThan(1500);
      expect(result.newDeviation).toBeLessThan(350);
    });

    it('rating decreases on loss', async () => {
      const cfg = await glickoRatingHandler.configure(
        { initialRating: 1500, initialDeviation: 350 },
        storage,
      );

      const result = await glickoRatingHandler.recordOutcome({
        config: cfg.config,
        participant: 'alice',
        opponent: 'bob',
        outcome: 0.0, // loss
      }, storage);
      expect(result.newRating).toBeLessThan(1500);
    });

    it('computes reliable weight inversely to deviation', async () => {
      const cfg = await glickoRatingHandler.configure(
        { initialRating: 1500, initialDeviation: 350 },
        storage,
      );

      // New player has high deviation → low reliability
      const fresh = await glickoRatingHandler.getReliableWeight(
        { config: cfg.config, participant: 'newbie' },
        storage,
      );
      expect(fresh.variant).toBe('weight');
      expect(fresh.reliability).toBeCloseTo(0, 1); // deviation = initialDev → reliability ≈ 0

      // After some games, deviation decreases → reliability increases
      await glickoRatingHandler.recordOutcome({ config: cfg.config, participant: 'veteran', opponent: 'x', outcome: 1 }, storage);
      await glickoRatingHandler.recordOutcome({ config: cfg.config, participant: 'veteran', opponent: 'y', outcome: 1 }, storage);
      await glickoRatingHandler.recordOutcome({ config: cfg.config, participant: 'veteran', opponent: 'z', outcome: 0 }, storage);

      const experienced = await glickoRatingHandler.getReliableWeight(
        { config: cfg.config, participant: 'veteran' },
        storage,
      );
      expect(experienced.reliability).toBeGreaterThan(fresh.reliability as number);
    });

    it('increases deviation on inactivity', async () => {
      const cfg = await glickoRatingHandler.configure(
        { initialDeviation: 350, inactivityGrowthRate: 30 },
        storage,
      );

      // Record an outcome to establish a player
      await glickoRatingHandler.recordOutcome({
        config: cfg.config,
        participant: 'alice',
        opponent: 'bob',
        outcome: 1.0,
      }, storage);

      const before = await glickoRatingHandler.getReliableWeight(
        { config: cfg.config, participant: 'alice' },
        storage,
      );

      // Apply inactivity decay (90 days, 3 growth periods)
      const decay = await glickoRatingHandler.applyInactivityDecay(
        { config: cfg.config, participant: 'alice', daysSinceActive: 90 },
        storage,
      );
      expect(decay.variant).toBe('decayed');
      expect(decay.newDeviation).toBeGreaterThan(before.deviation as number);
    });
  });
});
