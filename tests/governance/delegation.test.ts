// ============================================================
// Delegation Concept Conformance Tests
//
// Tests for transitive delegation: delegate, undelegate,
// cycle detection, and effective weight calculation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { delegationHandler } from '../../handlers/ts/app/governance/delegation.handler.js';

describe('Delegation Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('delegate', () => {
    it('creates a delegation edge', async () => {
      const result = await delegationHandler.delegate(
        { from: 'alice', to: 'bob', scope: 'all' },
        storage,
      );
      expect(result.variant).toBe('delegated');
      expect(result.edge).toBeTruthy();
    });

    it('detects direct cycles', async () => {
      await delegationHandler.delegate({ from: 'alice', to: 'bob', scope: 'all' }, storage);
      const cycle = await delegationHandler.delegate({ from: 'bob', to: 'alice', scope: 'all' }, storage);
      expect(cycle.variant).toBe('cycle_detected');
    });
  });

  describe('undelegate', () => {
    it('removes a delegation edge', async () => {
      await delegationHandler.delegate({ from: 'alice', to: 'bob', scope: 'all' }, storage);
      const result = await delegationHandler.undelegate({ from: 'alice', to: 'bob' }, storage);
      expect(result.variant).toBe('undelegated');
    });

    it('returns not_found for non-existent delegation', async () => {
      const result = await delegationHandler.undelegate({ from: 'alice', to: 'bob' }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('getEffectiveWeight', () => {
    it('returns weight for a participant', async () => {
      const result = await delegationHandler.getEffectiveWeight(
        { participant: 'alice' },
        storage,
      );
      expect(result.variant).toBe('weight');
      expect(result.effectiveWeight).toBeGreaterThanOrEqual(0);
    });
  });
});
