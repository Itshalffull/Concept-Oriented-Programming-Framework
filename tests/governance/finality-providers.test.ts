// ============================================================
// Finality Provider Conformance Tests
//
// Tests for all 4 finality providers: ImmediateFinality,
// ChainFinality, BftFinality, and OptimisticOracleFinality.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { immediateFinalityHandler } from '../../handlers/ts/app/governance/immediate-finality.handler.js';
import { chainFinalityHandler } from '../../handlers/ts/app/governance/chain-finality.handler.js';
import { bftFinalityHandler } from '../../handlers/ts/app/governance/bft-finality.handler.js';
import { optimisticOracleFinalityHandler } from '../../handlers/ts/app/governance/optimistic-oracle-finality.handler.js';

describe('Finality Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ────────────────────────────────────────────────
  //  ImmediateFinality
  // ────────────────────────────────────────────────
  describe('ImmediateFinality', () => {
    it('confirms an operation immediately', async () => {
      const result = await immediateFinalityHandler.confirm(
        { operationRef: 'op-001' },
        storage,
      );
      expect(result.variant).toBe('finalized');
      expect(result.confirmation).toBeDefined();
    });

    it('detects duplicate finalization', async () => {
      await immediateFinalityHandler.confirm({ operationRef: 'op-002' }, storage);
      const dupe = await immediateFinalityHandler.confirm(
        { operationRef: 'op-002' },
        storage,
      );
      expect(dupe.variant).toBe('already_finalized');
    });
  });

  // ────────────────────────────────────────────────
  //  ChainFinality
  // ────────────────────────────────────────────────
  describe('ChainFinality', () => {
    it('tracks a transaction', async () => {
      const track = await chainFinalityHandler.track({
        operationRef: 'op-001',
        txHash: '0xabc',
        chainId: 'ethereum',
        requiredConfirmations: 12,
        submittedBlock: 1000,
      }, storage);
      expect(track.variant).toBe('tracking');
      expect(track.entry).toBeDefined();
    });

    it('reports pending when insufficient confirmations', async () => {
      const track = await chainFinalityHandler.track({
        operationRef: 'op-002',
        txHash: '0xdef',
        chainId: 'ethereum',
        requiredConfirmations: 12,
        submittedBlock: 1000,
      }, storage);

      const check = await chainFinalityHandler.checkFinality({
        entry: track.entry,
        currentBlock: 1005,
      }, storage);
      expect(check.variant).toBe('pending');
      expect(check.currentConfirmations).toBe(5);
      expect(check.required).toBe(12);
    });

    it('confirms finality when enough blocks pass', async () => {
      const track = await chainFinalityHandler.track({
        operationRef: 'op-003',
        txHash: '0xghi',
        chainId: 'ethereum',
        requiredConfirmations: 6,
        submittedBlock: 100,
      }, storage);

      const check = await chainFinalityHandler.checkFinality({
        entry: track.entry,
        currentBlock: 110,
      }, storage);
      expect(check.variant).toBe('finalized');
      expect(check.currentConfirmations).toBe(10);
    });
  });

  // ────────────────────────────────────────────────
  //  BftFinality
  // ────────────────────────────────────────────────
  describe('BftFinality', () => {
    it('configures committee and proposes finality', async () => {
      const committee = await bftFinalityHandler.configureCommittee({
        validators: ['v1', 'v2', 'v3'],
      }, storage);
      expect(committee.variant).toBe('configured');

      const proposal = await bftFinalityHandler.proposeFinality({
        committee: committee.committee,
        operationRef: 'op-001',
        proposer: 'v1',
      }, storage);
      expect(proposal.variant).toBe('proposed');
      expect(proposal.roundNumber).toBeDefined();
    });

    it('achieves consensus with >2/3 votes', async () => {
      const committee = await bftFinalityHandler.configureCommittee({
        validators: ['v1', 'v2', 'v3'],
      }, storage);
      const proposal = await bftFinalityHandler.proposeFinality({
        committee: committee.committee,
        operationRef: 'op-002',
        proposer: 'v1',
      }, storage);

      // 2 out of 3 validators approve (>2/3 = need 2)
      await bftFinalityHandler.vote({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
        validator: 'v1',
        approve: true,
      }, storage);
      await bftFinalityHandler.vote({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
        validator: 'v2',
        approve: true,
      }, storage);

      const check = await bftFinalityHandler.checkConsensus({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
      }, storage);
      expect(check.variant).toBe('finalized');
    });

    it('reports insufficient votes before threshold', async () => {
      const committee = await bftFinalityHandler.configureCommittee({
        validators: ['v1', 'v2', 'v3', 'v4'],
      }, storage);
      const proposal = await bftFinalityHandler.proposeFinality({
        committee: committee.committee,
        operationRef: 'op-003',
        proposer: 'v1',
      }, storage);

      // Only 1 out of 4 votes (need 3 = ceil(4*2/3))
      await bftFinalityHandler.vote({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
        validator: 'v1',
        approve: true,
      }, storage);

      const check = await bftFinalityHandler.checkConsensus({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
      }, storage);
      expect(check.variant).toBe('insufficient');
    });

    it('rejects non-committee member vote', async () => {
      const committee = await bftFinalityHandler.configureCommittee({
        validators: ['v1', 'v2', 'v3'],
      }, storage);
      const proposal = await bftFinalityHandler.proposeFinality({
        committee: committee.committee,
        operationRef: 'op-004',
        proposer: 'v1',
      }, storage);

      const vote = await bftFinalityHandler.vote({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
        validator: 'intruder',
        approve: true,
      }, storage);
      expect(vote.variant).toBe('not_a_validator');
    });

    it('detects rejection when too many votes against', async () => {
      const committee = await bftFinalityHandler.configureCommittee({
        validators: ['v1', 'v2', 'v3'],
      }, storage);
      const proposal = await bftFinalityHandler.proposeFinality({
        committee: committee.committee,
        operationRef: 'op-005',
        proposer: 'v1',
      }, storage);

      // 2 rejections out of 3 validators
      await bftFinalityHandler.vote({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
        validator: 'v1',
        approve: false,
      }, storage);
      await bftFinalityHandler.vote({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
        validator: 'v2',
        approve: false,
      }, storage);

      const check = await bftFinalityHandler.checkConsensus({
        committee: committee.committee,
        roundNumber: proposal.roundNumber,
      }, storage);
      expect(check.variant).toBe('rejected');
    });
  });

  // ────────────────────────────────────────────────
  //  OptimisticOracleFinality
  // ────────────────────────────────────────────────
  describe('OptimisticOracleFinality', () => {
    it('asserts finality with bond', async () => {
      const result = await optimisticOracleFinalityHandler.assertFinality({
        operationRef: 'op-001',
        asserter: 'alice',
        bond: 100,
        challengeWindowHours: 24,
      }, storage);
      expect(result.variant).toBe('asserted');
      expect(result.assertion).toBeDefined();
    });

    it('allows challenge of pending assertion', async () => {
      const assert = await optimisticOracleFinalityHandler.assertFinality({
        operationRef: 'op-002',
        asserter: 'alice',
        bond: 100,
        challengeWindowHours: 24,
      }, storage);

      const challenge = await optimisticOracleFinalityHandler.challenge({
        assertion: assert.assertion,
        challenger: 'bob',
        bond: 100,
      }, storage);
      expect(challenge.variant).toBe('challenged');
    });

    it('resolves in favor of asserter', async () => {
      const assert = await optimisticOracleFinalityHandler.assertFinality({
        operationRef: 'op-003',
        asserter: 'alice',
        bond: 100,
        challengeWindowHours: 24,
      }, storage);
      await optimisticOracleFinalityHandler.challenge({
        assertion: assert.assertion,
        challenger: 'bob',
        bond: 50,
      }, storage);

      const resolve = await optimisticOracleFinalityHandler.resolve({
        assertion: assert.assertion,
        validAssertion: true,
      }, storage);
      expect(resolve.variant).toBe('finalized');
      expect(resolve.bondRecipient).toBe('alice');
      expect(resolve.totalBond).toBe(150); // 100 + 50
    });

    it('resolves in favor of challenger', async () => {
      const assert = await optimisticOracleFinalityHandler.assertFinality({
        operationRef: 'op-004',
        asserter: 'alice',
        bond: 100,
        challengeWindowHours: 24,
      }, storage);
      await optimisticOracleFinalityHandler.challenge({
        assertion: assert.assertion,
        challenger: 'bob',
        bond: 100,
      }, storage);

      const resolve = await optimisticOracleFinalityHandler.resolve({
        assertion: assert.assertion,
        validAssertion: false,
      }, storage);
      expect(resolve.variant).toBe('rejected');
      expect(resolve.bondRecipient).toBe('bob');
    });

    it('rejects challenge on non-pending assertion', async () => {
      const assert = await optimisticOracleFinalityHandler.assertFinality({
        operationRef: 'op-005',
        asserter: 'alice',
        bond: 100,
        challengeWindowHours: 24,
      }, storage);

      // Challenge once
      await optimisticOracleFinalityHandler.challenge({
        assertion: assert.assertion,
        challenger: 'bob',
        bond: 50,
      }, storage);

      // Try to challenge again (status is now Challenged, not Pending)
      const secondChallenge = await optimisticOracleFinalityHandler.challenge({
        assertion: assert.assertion,
        challenger: 'charlie',
        bond: 50,
      }, storage);
      expect(secondChallenge.variant).toBe('not_pending');
    });
  });
});
