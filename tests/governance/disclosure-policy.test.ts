// ============================================================
// Disclosure Policy Concept Conformance Tests
//
// Tests for disclosure policies: definition, evaluation,
// and suspension.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { disclosurePolicyHandler } from '../../handlers/ts/app/governance/disclosure-policy.handler.js';

describe('Disclosure Policy Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('define', () => {
    it('defines a disclosure policy', async () => {
      const result = await disclosurePolicyHandler.define({
        scope: 'treasury-transactions', timing: 'realtime',
        audience: 'members', format: 'json',
      }, storage);
      expect(result.variant).toBe('defined');
      expect(result.policy).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('evaluates a disclosable event', async () => {
      const p = await disclosurePolicyHandler.define({
        scope: 'votes', timing: 'after-close', audience: 'public',
      }, storage);
      const result = await disclosurePolicyHandler.evaluate({
        policy: p.policy, event: 'vote-results', requestor: 'anyone',
      }, storage);
      expect(result.variant).toBe('disclosable');
    });
  });

  describe('suspend', () => {
    it('suspends a disclosure policy', async () => {
      const p = await disclosurePolicyHandler.define({
        scope: 'financials', timing: 'quarterly', audience: 'board',
      }, storage);
      const result = await disclosurePolicyHandler.suspend({
        policy: p.policy, reason: 'Regulatory review',
      }, storage);
      expect(result.variant).toBe('suspended');
    });

    it('evaluates suspended policy as suspended', async () => {
      const p = await disclosurePolicyHandler.define({
        scope: 'data', timing: 'immediate', audience: 'all',
      }, storage);
      await disclosurePolicyHandler.suspend({ policy: p.policy, reason: 'Pause' }, storage);
      const result = await disclosurePolicyHandler.evaluate({
        policy: p.policy, event: 'data-export', requestor: 'user',
      }, storage);
      expect(result.variant).toBe('suspended');
    });
  });
});
