// ============================================================
// Sanction Concept Conformance Tests
//
// Tests for graduated sanctions (Ostrom DP5): impose, escalate
// through severity levels, appeal, pardon, and reward.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { sanctionHandler } from '../../handlers/ts/app/governance/sanction.handler.js';

describe('Sanction Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('impose', () => {
    it('creates a sanction record', async () => {
      const result = await sanctionHandler.impose(
        { subject: 'alice', severity: 'Warning', consequence: 'verbal_warning', reason: 'late_report' },
        storage,
      );
      expect(result.variant).toBe('imposed');
      expect(result.sanction).toBeTruthy();
    });
  });

  describe('escalate', () => {
    it('escalates severity by one level', async () => {
      const { sanction } = await sanctionHandler.impose(
        { subject: 'alice', severity: 'Warning', consequence: 'verbal', reason: 'test' },
        storage,
      );
      const result = await sanctionHandler.escalate({ sanction }, storage);
      expect(result.variant).toBe('escalated');
      expect(result.newSeverity).toBe('Minor');
    });

    it('caps at Expulsion severity', async () => {
      const { sanction } = await sanctionHandler.impose(
        { subject: 'alice', severity: 'Critical', consequence: 'ban', reason: 'test' },
        storage,
      );
      const result = await sanctionHandler.escalate({ sanction }, storage);
      expect(result.newSeverity).toBe('Expulsion');
    });
  });

  describe('appeal / pardon', () => {
    it('files an appeal against a sanction', async () => {
      const { sanction } = await sanctionHandler.impose(
        { subject: 'alice', severity: 'Minor', consequence: 'fine', reason: 'test' },
        storage,
      );
      const result = await sanctionHandler.appeal({ sanction, appellant: 'alice', grounds: 'mistake' }, storage);
      expect(result.variant).toBe('appealed');
    });

    it('pardons a sanction', async () => {
      const { sanction } = await sanctionHandler.impose(
        { subject: 'alice', severity: 'Minor', consequence: 'fine', reason: 'test' },
        storage,
      );
      const result = await sanctionHandler.pardon({ sanction, reason: 'good_behavior' }, storage);
      expect(result.variant).toBe('pardoned');
    });
  });

  describe('reward', () => {
    it('creates a positive sanction (reward)', async () => {
      const result = await sanctionHandler.reward(
        { subject: 'alice', type: 'bonus', amount: 100, reason: 'contribution' },
        storage,
      );
      expect(result.variant).toBe('rewarded');
    });
  });
});
