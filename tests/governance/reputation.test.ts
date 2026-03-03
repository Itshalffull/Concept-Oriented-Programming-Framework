// ============================================================
// Reputation Concept Conformance Tests
//
// Tests for reputation lifecycle: earn, burn, decay,
// score queries, and recalculation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { reputationHandler } from '../../handlers/ts/app/governance/reputation.handler.js';

describe('Reputation Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('earn', () => {
    it('accumulates reputation score', async () => {
      const r1 = await reputationHandler.earn(
        { participant: 'alice', amount: 10, reason: 'proposal_executed' },
        storage,
      );
      expect(r1.variant).toBe('earned');
      expect(r1.newScore).toBe(10);

      const r2 = await reputationHandler.earn(
        { participant: 'alice', amount: 5, reason: 'contribution' },
        storage,
      );
      expect(r2.newScore).toBe(15);
    });
  });

  describe('burn', () => {
    it('reduces reputation score', async () => {
      await reputationHandler.earn({ participant: 'alice', amount: 20, reason: 'test' }, storage);
      const result = await reputationHandler.burn({ participant: 'alice', amount: 8, reason: 'sanction' }, storage);
      expect(result.variant).toBe('burned');
      expect(result.newScore).toBe(12);
    });

    it('does not go below zero', async () => {
      await reputationHandler.earn({ participant: 'alice', amount: 5, reason: 'test' }, storage);
      const result = await reputationHandler.burn({ participant: 'alice', amount: 100, reason: 'test' }, storage);
      expect(result.newScore).toBe(0);
    });
  });

  describe('decay', () => {
    it('applies proportional decay', async () => {
      await reputationHandler.earn({ participant: 'alice', amount: 100, reason: 'test' }, storage);
      const result = await reputationHandler.decay({ participant: 'alice', decayFactor: 0.1 }, storage);
      expect(result.variant).toBe('decayed');
      expect(result.newScore).toBe(90);
    });
  });

  describe('getScore', () => {
    it('returns zero for unknown participant', async () => {
      const result = await reputationHandler.getScore({ participant: 'ghost' }, storage);
      expect(result.variant).toBe('score');
      expect(result.score).toBe(0.0);
    });

    it('returns current score for known participant', async () => {
      await reputationHandler.earn({ participant: 'alice', amount: 42, reason: 'test' }, storage);
      const result = await reputationHandler.getScore({ participant: 'alice' }, storage);
      expect(result.score).toBe(42);
    });
  });
});
