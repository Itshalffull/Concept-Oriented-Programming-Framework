// ============================================================
// Weight Source Provider Conformance Tests
//
// Tests for all 6 weight source providers: TokenBalance,
// ReputationWeight, StakeWeight, EqualWeight, VoteEscrow,
// and QuadraticWeight.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { tokenBalanceHandler } from '../../handlers/ts/app/governance/token-balance.handler.js';
import { reputationWeightHandler } from '../../handlers/ts/app/governance/reputation-weight.handler.js';
import { stakeWeightHandler } from '../../handlers/ts/app/governance/stake-weight.handler.js';
import { equalWeightHandler } from '../../handlers/ts/app/governance/equal-weight.handler.js';
import { voteEscrowHandler } from '../../handlers/ts/app/governance/vote-escrow.handler.js';
import { quadraticWeightHandler } from '../../handlers/ts/app/governance/quadratic-weight.handler.js';

describe('Weight Source Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ────────────────────────────────────────────────
  //  TokenBalance
  // ────────────────────────────────────────────────
  describe('TokenBalance', () => {
    it('configures and sets balances', async () => {
      const cfg = await tokenBalanceHandler.configure(
        { tokenContract: '0xToken' },
        storage,
      );
      expect(cfg.variant).toBe('configured');

      const update = await tokenBalanceHandler.setBalance(
        { config: cfg.config, participant: 'alice', balance: 1000 },
        storage,
      );
      expect(update.variant).toBe('updated');
      expect(update.balance).toBe(1000);
    });

    it('retrieves current balance', async () => {
      const cfg = await tokenBalanceHandler.configure({ tokenContract: '0xT' }, storage);
      await tokenBalanceHandler.setBalance({ config: cfg.config, participant: 'alice', balance: 500 }, storage);
      const result = await tokenBalanceHandler.getBalance(
        { config: cfg.config, participant: 'alice' },
        storage,
      );
      expect(result.variant).toBe('balance');
      expect(result.balance).toBe(500);
    });

    it('takes a snapshot and retrieves from it', async () => {
      const cfg = await tokenBalanceHandler.configure({ tokenContract: '0xT' }, storage);
      await tokenBalanceHandler.setBalance({ config: cfg.config, participant: 'alice', balance: 100 }, storage);
      await tokenBalanceHandler.setBalance({ config: cfg.config, participant: 'bob', balance: 200 }, storage);

      const snap = await tokenBalanceHandler.takeSnapshot(
        { config: cfg.config, blockRef: 'block-42' },
        storage,
      );
      expect(snap.variant).toBe('snapped');
      expect(snap.participantCount).toBe(2);

      // Change balance after snapshot
      await tokenBalanceHandler.setBalance({ config: cfg.config, participant: 'alice', balance: 999 }, storage);

      // Snapshot still returns old value
      const fromSnap = await tokenBalanceHandler.getBalance(
        { config: cfg.config, participant: 'alice', snapshot: snap.snapshot },
        storage,
      );
      expect(fromSnap.balance).toBe(100);
    });

    it('returns 0 for unknown participant', async () => {
      const cfg = await tokenBalanceHandler.configure({ tokenContract: '0xT' }, storage);
      const result = await tokenBalanceHandler.getBalance(
        { config: cfg.config, participant: 'nobody' },
        storage,
      );
      expect(result.balance).toBe(0);
    });
  });

  // ────────────────────────────────────────────────
  //  ReputationWeight
  // ────────────────────────────────────────────────
  describe('ReputationWeight', () => {
    it('computes linear weight', async () => {
      const cfg = await reputationWeightHandler.configure({ scalingFunction: 'linear' }, storage);
      const result = await reputationWeightHandler.compute(
        { config: cfg.config, participant: 'alice', reputationScore: 42 },
        storage,
      );
      expect(result.variant).toBe('weight');
      expect(result.weight).toBe(42);
    });

    it('computes log-scaled weight', async () => {
      const cfg = await reputationWeightHandler.configure({ scalingFunction: 'log' }, storage);
      const result = await reputationWeightHandler.compute(
        { config: cfg.config, participant: 'alice', reputationScore: 100 },
        storage,
      );
      expect(result.weight).toBeCloseTo(Math.log(101), 5);
    });

    it('computes sigmoid-scaled weight', async () => {
      const cfg = await reputationWeightHandler.configure({ scalingFunction: 'sigmoid' }, storage);
      const result = await reputationWeightHandler.compute(
        { config: cfg.config, participant: 'alice', reputationScore: 0 },
        storage,
      );
      expect(result.weight).toBeCloseTo(0.5, 5);
    });

    it('respects cap', async () => {
      const cfg = await reputationWeightHandler.configure({ scalingFunction: 'linear', cap: 10 }, storage);
      const result = await reputationWeightHandler.compute(
        { config: cfg.config, participant: 'alice', reputationScore: 100 },
        storage,
      );
      expect(result.weight).toBe(10);
    });
  });

  // ────────────────────────────────────────────────
  //  StakeWeight
  // ────────────────────────────────────────────────
  describe('StakeWeight', () => {
    it('stakes and reports weight', async () => {
      const cfg = await stakeWeightHandler.configure({ token: 'GOV', cooldownDays: 0 }, storage);
      const staked = await stakeWeightHandler.stake(
        { config: cfg.config, staker: 'alice', amount: 500 },
        storage,
      );
      expect(staked.variant).toBe('staked');

      const weight = await stakeWeightHandler.getWeight(
        { config: cfg.config, participant: 'alice' },
        storage,
      );
      expect(weight.variant).toBe('weight');
      expect(weight.stakedAmount).toBe(500);
    });

    it('sums multiple stakes', async () => {
      const cfg = await stakeWeightHandler.configure({ token: 'GOV', cooldownDays: 0 }, storage);
      await stakeWeightHandler.stake({ config: cfg.config, staker: 'alice', amount: 100 }, storage);
      // Small delay to ensure different stake IDs
      await new Promise(r => setTimeout(r, 2));
      await stakeWeightHandler.stake({ config: cfg.config, staker: 'alice', amount: 200 }, storage);

      const weight = await stakeWeightHandler.getWeight(
        { config: cfg.config, participant: 'alice' },
        storage,
      );
      expect(weight.stakedAmount).toBe(300);
    });

    it('unstakes without cooldown', async () => {
      const cfg = await stakeWeightHandler.configure({ token: 'GOV', cooldownDays: 0 }, storage);
      const staked = await stakeWeightHandler.stake(
        { config: cfg.config, staker: 'alice', amount: 100 },
        storage,
      );
      const unstaked = await stakeWeightHandler.unstake({ stake: staked.stake }, storage);
      expect(unstaked.variant).toBe('unstaked');
    });
  });

  // ────────────────────────────────────────────────
  //  EqualWeight
  // ────────────────────────────────────────────────
  describe('EqualWeight', () => {
    it('returns fixed weight for any participant', async () => {
      const cfg = await equalWeightHandler.configure({ weightPerPerson: 1 }, storage);
      const result = await equalWeightHandler.getWeight(
        { config: cfg.config, participant: 'alice' },
        storage,
      );
      expect(result.variant).toBe('weight');
      expect(result.weight).toBe(1);
    });

    it('supports custom weight per person', async () => {
      const cfg = await equalWeightHandler.configure({ weightPerPerson: 5 }, storage);
      const result = await equalWeightHandler.getWeight(
        { config: cfg.config, participant: 'bob' },
        storage,
      );
      expect(result.weight).toBe(5);
    });
  });

  // ────────────────────────────────────────────────
  //  VoteEscrow
  // ────────────────────────────────────────────────
  describe('VoteEscrow', () => {
    it('locks tokens and receives veTokens proportional to lock duration', async () => {
      const cfg = await voteEscrowHandler.configure({ maxLockYears: 4, token: 'GOV' }, storage);
      const lock = await voteEscrowHandler.lock({
        config: cfg.config,
        locker: 'alice',
        amount: 1000,
        lockYears: 4, // max lock → veTokens = amount
      }, storage);
      expect(lock.variant).toBe('locked');
      expect(lock.veTokens).toBe(1000); // 1000 * (4/4)
    });

    it('gives proportional veTokens for partial lock', async () => {
      const cfg = await voteEscrowHandler.configure({ maxLockYears: 4, token: 'GOV' }, storage);
      const lock = await voteEscrowHandler.lock({
        config: cfg.config,
        locker: 'alice',
        amount: 1000,
        lockYears: 2, // half max → veTokens = 500
      }, storage);
      expect(lock.veTokens).toBe(500);
    });

    it('extends a lock', async () => {
      const cfg = await voteEscrowHandler.configure({ maxLockYears: 4, token: 'GOV' }, storage);
      const lock = await voteEscrowHandler.lock({
        config: cfg.config,
        locker: 'alice',
        amount: 1000,
        lockYears: 1,
      }, storage);
      const extended = await voteEscrowHandler.extendLock({
        lock: lock.lock,
        additionalYears: 2,
      }, storage);
      expect(extended.variant).toBe('extended');
      expect(extended.newLockYears).toBe(3);
      expect(extended.veTokens).toBe(750); // 1000 * (3/4)
    });
  });

  // ────────────────────────────────────────────────
  //  QuadraticWeight
  // ────────────────────────────────────────────────
  describe('QuadraticWeight', () => {
    it('computes sqrt-scaled weight', async () => {
      const cfg = await quadraticWeightHandler.configure({}, storage);
      const result = await quadraticWeightHandler.compute(
        { config: cfg.config, participant: 'alice', balance: 100 },
        storage,
      );
      expect(result.variant).toBe('weight');
      expect(result.sqrtWeight).toBeCloseTo(10, 5); // sqrt(100)
    });

    it('handles zero input', async () => {
      const cfg = await quadraticWeightHandler.configure({}, storage);
      const result = await quadraticWeightHandler.compute(
        { config: cfg.config, participant: 'alice', balance: 0 },
        storage,
      );
      expect(result.sqrtWeight).toBe(0);
    });
  });
});
