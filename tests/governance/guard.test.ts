// ============================================================
// Guard Concept Conformance Tests
//
// Tests for governance guards: registration, pre/post checks,
// enable/disable lifecycle.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { guardHandler } from '../../handlers/ts/app/governance/guard.handler.js';

describe('Guard Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a guard', async () => {
      const result = await guardHandler.register({
        name: 'balance-check', targetAction: 'withdraw',
        checkType: 'pre', condition: 'balance >= amount',
      }, storage);
      expect(result.variant).toBe('registered');
      expect(result.guard).toBeDefined();
    });
  });

  describe('checkPre', () => {
    it('allows a pre-check', async () => {
      const g = await guardHandler.register({
        name: 'test-guard', targetAction: 'transfer',
        checkType: 'pre', condition: 'always-pass',
      }, storage);
      const result = await guardHandler.checkPre({
        guard: g.guard, context: { amount: 50 },
      }, storage);
      expect(result.variant).toBe('allowed');
    });
  });

  describe('checkPost', () => {
    it('passes a post-check', async () => {
      const g = await guardHandler.register({
        name: 'post-guard', targetAction: 'execute',
        checkType: 'post', condition: 'result-valid',
      }, storage);
      const result = await guardHandler.checkPost({
        guard: g.guard, context: {}, result: { success: true },
      }, storage);
      expect(result.variant).toBe('passed');
    });
  });

  describe('enable / disable', () => {
    it('disables and re-enables a guard', async () => {
      const g = await guardHandler.register({
        name: 'toggle', targetAction: 'action',
        checkType: 'pre', condition: 'check',
      }, storage);

      const disabled = await guardHandler.disable({ guard: g.guard }, storage);
      expect(disabled.variant).toBe('disabled');

      const check = await guardHandler.checkPre({ guard: g.guard, context: {} }, storage);
      expect(check.variant).toBe('guard_disabled');

      const enabled = await guardHandler.enable({ guard: g.guard }, storage);
      expect(enabled.variant).toBe('enabled');
    });
  });
});
