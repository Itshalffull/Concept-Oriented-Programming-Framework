// ============================================================
// Membership Concept Conformance Tests
//
// Tests for member lifecycle: join, leave, suspend, reinstate,
// kick, and rule updates for governance polities.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { membershipHandler } from '../../handlers/ts/app/governance/membership.handler.js';

describe('Membership Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('join', () => {
    it('creates a new membership', async () => {
      const result = await membershipHandler.join(
        { member: 'alice', polity: 'dao-1' },
        storage,
      );
      expect(result.variant).toBe('joined');
    });

    it('rejects duplicate membership', async () => {
      await membershipHandler.join({ member: 'alice', polity: 'dao-1' }, storage);
      const result = await membershipHandler.join({ member: 'alice', polity: 'dao-1' }, storage);
      expect(result.variant).toBe('already_member');
    });
  });

  describe('leave', () => {
    it('removes an existing member', async () => {
      await membershipHandler.join({ member: 'alice', polity: 'dao-1' }, storage);
      const result = await membershipHandler.leave({ member: 'alice' }, storage);
      expect(result.variant).toBe('left');
    });

    it('returns not_found for non-member', async () => {
      const result = await membershipHandler.leave({ member: 'ghost' }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('suspend / reinstate', () => {
    it('suspends and reinstates a member', async () => {
      await membershipHandler.join({ member: 'bob', polity: 'dao-1' }, storage);
      const sus = await membershipHandler.suspend({ member: 'bob', until: '2026-12-31' }, storage);
      expect(sus.variant).toBe('suspended');

      const rein = await membershipHandler.reinstate({ member: 'bob' }, storage);
      expect(rein.variant).toBe('reinstated');
    });
  });

  describe('kick', () => {
    it('forcibly removes a member', async () => {
      await membershipHandler.join({ member: 'charlie', polity: 'dao-1' }, storage);
      const result = await membershipHandler.kick({ member: 'charlie', reason: 'expulsion' }, storage);
      expect(result.variant).toBe('kicked');

      // Confirm they are gone
      const leave = await membershipHandler.leave({ member: 'charlie' }, storage);
      expect(leave.variant).toBe('not_found');
    });
  });

  describe('updateRules', () => {
    it('stores governance join/exit conditions', async () => {
      const result = await membershipHandler.updateRules(
        { polity: 'dao-1', joinConditions: 'sybil-verified', exitConditions: 'anytime' },
        storage,
      );
      expect(result.variant).toBe('updated');
    });
  });
});
