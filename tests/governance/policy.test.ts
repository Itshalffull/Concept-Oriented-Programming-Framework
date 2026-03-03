// ============================================================
// Policy Concept Conformance Tests
//
// Tests for policy lifecycle: creation, evaluation, suspension,
// modification, and repeal.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { policyHandler } from '../../handlers/ts/app/governance/policy.handler.js';

describe('Policy Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a policy', async () => {
      const result = await policyHandler.create({
        attributes: 'member', deontic: 'must', aim: 'disclose',
        conditions: 'during-session',
      }, storage);
      expect(result.variant).toBe('created');
      expect(result.policy).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('evaluates a compliant context', async () => {
      const p = await policyHandler.create({
        attributes: '*', deontic: 'must', aim: 'report', conditions: 'always',
      }, storage);
      const result = await policyHandler.evaluate({
        policy: p.policy, context: { actor: 'alice', action: 'report' },
      }, storage);
      expect(result.variant).toBe('compliant');
    });
  });

  describe('suspend / repeal', () => {
    it('suspends a policy', async () => {
      const p = await policyHandler.create({
        attributes: '*', deontic: 'may', aim: 'trade', conditions: 'market-hours',
      }, storage);
      const result = await policyHandler.suspend({
        policy: p.policy, reason: 'Emergency halt',
      }, storage);
      expect(result.variant).toBe('suspended');
    });

    it('evaluates suspended policy as suspended', async () => {
      const p = await policyHandler.create({
        attributes: '*', deontic: 'may', aim: 'trade', conditions: 'always',
      }, storage);
      await policyHandler.suspend({ policy: p.policy, reason: 'Halt' }, storage);
      const result = await policyHandler.evaluate({
        policy: p.policy, context: {},
      }, storage);
      expect(result.variant).toBe('suspended');
    });

    it('repeals a policy', async () => {
      const p = await policyHandler.create({
        attributes: '*', deontic: 'must', aim: 'vote', conditions: 'always',
      }, storage);
      const result = await policyHandler.repeal({ policy: p.policy }, storage);
      expect(result.variant).toBe('repealed');
    });
  });

  describe('modify', () => {
    it('modifies a policy field', async () => {
      const p = await policyHandler.create({
        attributes: 'admin', deontic: 'must', aim: 'review', conditions: 'always',
      }, storage);
      const result = await policyHandler.modify({
        policy: p.policy, deontic: 'should',
      }, storage);
      expect(result.variant).toBe('modified');
    });
  });
});
