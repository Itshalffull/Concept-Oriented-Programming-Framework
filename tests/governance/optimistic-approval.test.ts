// ============================================================
// OptimisticApproval Concept Conformance Tests
//
// Tests for approve-unless-challenged pattern: assert,
// challenge, finalize, and resolve.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { optimisticApprovalHandler } from '../../handlers/ts/app/governance/optimistic-approval.handler.js';

describe('OptimisticApproval Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('assert', () => {
    it('creates a pending assertion', async () => {
      const result = await optimisticApprovalHandler.assert(
        { asserter: 'alice', payload: 'action-1', bond: 100, challengePeriodHours: 48 },
        storage,
      );
      expect(result.variant).toBe('asserted');
      expect(result.assertion).toBeTruthy();
    });
  });

  describe('finalize', () => {
    it('approves an unchallenged assertion', async () => {
      const { assertion } = await optimisticApprovalHandler.assert(
        { asserter: 'alice', payload: 'action-1', bond: 100, challengePeriodHours: 48 },
        storage,
      );
      const result = await optimisticApprovalHandler.finalize({ assertion }, storage);
      expect(result.variant).toBe('approved');
    });
  });

  describe('challenge', () => {
    it('marks assertion as challenged', async () => {
      const { assertion } = await optimisticApprovalHandler.assert(
        { asserter: 'alice', payload: 'action-1', bond: 100, challengePeriodHours: 48 },
        storage,
      );
      const result = await optimisticApprovalHandler.challenge(
        { assertion, challenger: 'bob', bond: 50, evidence: 'invalid_action' },
        storage,
      );
      expect(result.variant).toBe('challenged');
    });
  });

  describe('resolve', () => {
    it('rejects the assertion when challenge is upheld', async () => {
      const { assertion } = await optimisticApprovalHandler.assert(
        { asserter: 'alice', payload: 'action-1', bond: 100, challengePeriodHours: 48 },
        storage,
      );
      await optimisticApprovalHandler.challenge(
        { assertion, challenger: 'bob', bond: 50, evidence: 'proof' },
        storage,
      );
      const result = await optimisticApprovalHandler.resolve({ assertion, upheld: true }, storage);
      expect(result.variant).toBe('rejected');
    });

    it('approves the assertion when challenge fails', async () => {
      const { assertion } = await optimisticApprovalHandler.assert(
        { asserter: 'alice', payload: 'action-1', bond: 100, challengePeriodHours: 48 },
        storage,
      );
      await optimisticApprovalHandler.challenge(
        { assertion, challenger: 'bob', bond: 50, evidence: 'proof' },
        storage,
      );
      const result = await optimisticApprovalHandler.resolve({ assertion, upheld: false }, storage);
      expect(result.variant).toBe('approved');
    });
  });
});
