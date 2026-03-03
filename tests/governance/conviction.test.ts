// ============================================================
// Conviction Concept Conformance Tests
//
// Tests for conviction voting: proposal registration, staking,
// unstaking, and conviction threshold checks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { convictionHandler } from '../../handlers/ts/app/governance/conviction.handler.js';

describe('Conviction Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('registerProposal', () => {
    it('registers a proposal for conviction voting', async () => {
      const result = await convictionHandler.registerProposal({
        proposalRef: 'prop-1', threshold: 100, halfLifeDays: 7,
      }, storage);
      expect(result.variant).toBe('registered');
      expect(result.proposal).toBeDefined();
    });
  });

  describe('stake / unstake', () => {
    it('stakes tokens on a proposal', async () => {
      const p = await convictionHandler.registerProposal({
        proposalRef: 'prop-2', threshold: 100, halfLifeDays: 7,
      }, storage);
      const result = await convictionHandler.stake({
        proposal: p.proposal, staker: 'alice', amount: 50,
      }, storage);
      expect(result.variant).toBe('staked');
    });

    it('unstakes tokens from a proposal', async () => {
      const p = await convictionHandler.registerProposal({
        proposalRef: 'prop-3', threshold: 100, halfLifeDays: 7,
      }, storage);
      await convictionHandler.stake({ proposal: p.proposal, staker: 'alice', amount: 50 }, storage);
      const result = await convictionHandler.unstake({
        proposal: p.proposal, staker: 'alice', amount: 20,
      }, storage);
      expect(result.variant).toBe('unstaked');
    });
  });

  describe('updateConviction', () => {
    it('triggers when threshold is met', async () => {
      const p = await convictionHandler.registerProposal({
        proposalRef: 'prop-4', threshold: 50, halfLifeDays: 7,
      }, storage);
      await convictionHandler.stake({ proposal: p.proposal, staker: 'alice', amount: 60 }, storage);
      const result = await convictionHandler.updateConviction({ proposal: p.proposal }, storage);
      expect(result.variant).toBe('triggered');
    });

    it('updates without triggering when below threshold', async () => {
      const p = await convictionHandler.registerProposal({
        proposalRef: 'prop-5', threshold: 100, halfLifeDays: 7,
      }, storage);
      await convictionHandler.stake({ proposal: p.proposal, staker: 'alice', amount: 30 }, storage);
      const result = await convictionHandler.updateConviction({ proposal: p.proposal }, storage);
      expect(result.variant).toBe('updated');
    });
  });
});
