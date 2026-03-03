// ============================================================
// Proposal Concept Conformance Tests
//
// Tests for proposal lifecycle: create, sponsor, activate,
// advance, and cancel following governance decision pipeline.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { proposalHandler } from '../../handlers/ts/app/governance/proposal.handler.js';

describe('Proposal Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a proposal in Draft status', async () => {
      const result = await proposalHandler.create(
        { proposer: 'alice', title: 'Fund project X', description: 'Allocate 100 ETH', actions: 'transfer(100)' },
        storage,
      );
      expect(result.variant).toBe('created');
      expect(result.proposal).toBeTruthy();
    });
  });

  describe('sponsor', () => {
    it('moves Draft to Sponsored', async () => {
      const { proposal } = await proposalHandler.create(
        { proposer: 'alice', title: 'Test', description: '', actions: '' },
        storage,
      );
      const result = await proposalHandler.sponsor({ proposal, sponsor: 'bob' }, storage);
      expect(result.variant).toBe('sponsored');
    });

    it('returns not_found for invalid proposal', async () => {
      const result = await proposalHandler.sponsor({ proposal: 'nonexistent', sponsor: 'bob' }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('activate', () => {
    it('moves proposal to Active', async () => {
      const { proposal } = await proposalHandler.create(
        { proposer: 'alice', title: 'Test', description: '', actions: '' },
        storage,
      );
      const result = await proposalHandler.activate({ proposal }, storage);
      expect(result.variant).toBe('activated');
    });
  });

  describe('advance', () => {
    it('advances proposal to a given status', async () => {
      const { proposal } = await proposalHandler.create(
        { proposer: 'alice', title: 'Test', description: '', actions: '' },
        storage,
      );
      await proposalHandler.activate({ proposal }, storage);
      const result = await proposalHandler.advance({ proposal, newStatus: 'Passed' }, storage);
      expect(result.variant).toBe('advanced');
      expect(result.status).toBe('Passed');
    });
  });

  describe('cancel', () => {
    it('cancels a proposal with reason', async () => {
      const { proposal } = await proposalHandler.create(
        { proposer: 'alice', title: 'Test', description: '', actions: '' },
        storage,
      );
      const result = await proposalHandler.cancel({ proposal, reason: 'withdrawn' }, storage);
      expect(result.variant).toBe('cancelled');
    });
  });
});
