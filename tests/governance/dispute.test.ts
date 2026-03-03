// ============================================================
// Dispute Concept Conformance Tests
//
// Tests for dispute resolution: open, submit evidence,
// arbitrate, and appeal.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { disputeHandler } from '../../handlers/ts/app/governance/dispute.handler.js';

describe('Dispute Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('open', () => {
    it('opens a new dispute', async () => {
      const result = await disputeHandler.open(
        { challenger: 'alice', respondent: 'bob', subject: 'proposal-42', evidence: 'doc-1', bond: 100 },
        storage,
      );
      expect(result.variant).toBe('opened');
      expect(result.dispute).toBeTruthy();
    });
  });

  describe('submitEvidence', () => {
    it('adds evidence to an open dispute', async () => {
      const { dispute } = await disputeHandler.open(
        { challenger: 'alice', respondent: 'bob', subject: 'test', evidence: 'doc-1', bond: 100 },
        storage,
      );
      const result = await disputeHandler.submitEvidence(
        { dispute, party: 'bob', evidence: 'counter-doc-1' },
        storage,
      );
      expect(result.variant).toBe('evidence_added');
    });
  });

  describe('arbitrate', () => {
    it('resolves a dispute', async () => {
      const { dispute } = await disputeHandler.open(
        { challenger: 'alice', respondent: 'bob', subject: 'test', evidence: 'doc-1', bond: 100 },
        storage,
      );
      const result = await disputeHandler.arbitrate(
        { dispute, arbitrator: 'judge', decision: 'challenger_wins', reasoning: 'valid evidence' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.decision).toBe('challenger_wins');
    });
  });

  describe('appeal', () => {
    it('allows appeal of a resolved dispute', async () => {
      const { dispute } = await disputeHandler.open(
        { challenger: 'alice', respondent: 'bob', subject: 'test', evidence: 'doc-1', bond: 100 },
        storage,
      );
      await disputeHandler.arbitrate(
        { dispute, arbitrator: 'judge', decision: 'challenger_wins', reasoning: 'reason' },
        storage,
      );
      const result = await disputeHandler.appeal(
        { dispute, appellant: 'bob', grounds: 'new_evidence' },
        storage,
      );
      expect(result.variant).toBe('appealed');
    });

    it('rejects appeal on non-resolved dispute', async () => {
      const { dispute } = await disputeHandler.open(
        { challenger: 'alice', respondent: 'bob', subject: 'test', evidence: 'doc-1', bond: 100 },
        storage,
      );
      const result = await disputeHandler.appeal(
        { dispute, appellant: 'bob', grounds: 'test' },
        storage,
      );
      expect(result.variant).toBe('not_resolved');
    });
  });
});
