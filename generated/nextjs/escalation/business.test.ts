// Escalation — business.test.ts
// Business logic tests for escalation lifecycle with severity tracking and re-escalation.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { escalationHandler } from './handler.js';
import type { EscalationStorage } from './types.js';

const createTestStorage = (): EscalationStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter) => {
      const entries = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return entries;
      return entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => e[k] === v),
      );
    },
  };
};

describe('Escalation business logic', () => {
  it('full lifecycle: escalate -> accept -> resolve', async () => {
    const storage = createTestStorage();

    const escResult = await escalationHandler.escalate({
      run_ref: 'run-1',
      step_ref: 'payment',
      reason: 'Payment gateway timeout after 3 retries',
      severity: 'high',
      escalation_target: 'ops-team',
      context: { gateway: 'stripe', error_count: 3 },
    }, storage)();

    if (E.isRight(escResult) && escResult.right.variant === 'ok') {
      expect(escResult.right.status).toBe('escalated');
      expect(escResult.right.severity).toBe('high');
    }

    const acceptResult = await escalationHandler.accept({
      run_ref: 'run-1',
      step_ref: 'payment',
      accepted_by: 'oncall-eng',
    }, storage)();

    if (E.isRight(acceptResult) && acceptResult.right.variant === 'ok') {
      expect(acceptResult.right.status).toBe('accepted');
      expect(acceptResult.right.accepted_by).toBe('oncall-eng');
    }

    const resolveResult = await escalationHandler.resolve({
      run_ref: 'run-1',
      step_ref: 'payment',
      resolution: 'Switched to backup payment gateway',
      resolved_by: 'oncall-eng',
    }, storage)();

    if (E.isRight(resolveResult) && resolveResult.right.variant === 'ok') {
      expect(resolveResult.right.status).toBe('resolved');
      expect(resolveResult.right.resolution).toBe('Switched to backup payment gateway');
    }
  });

  it('re-escalate from escalated state increments count and changes target', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-2',
      step_ref: 'database',
      reason: 'Connection pool exhausted',
      severity: 'medium',
      escalation_target: 'dba-team',
    }, storage)();

    const reEsc = await escalationHandler.re_escalate({
      run_ref: 'run-2',
      step_ref: 'database',
      new_target: 'infrastructure-team',
      reason: 'DBA team unavailable',
    }, storage)();

    if (E.isRight(reEsc) && reEsc.right.variant === 'ok') {
      expect(reEsc.right.status).toBe('escalated');
      expect(reEsc.right.new_target).toBe('infrastructure-team');
      expect(reEsc.right.escalation_count).toBe(2);
    }
  });

  it('re-escalate from accepted state increments count', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-3',
      step_ref: 'api',
      reason: 'API rate limited',
      severity: 'low',
      escalation_target: 'api-team',
    }, storage)();

    await escalationHandler.accept({
      run_ref: 'run-3',
      step_ref: 'api',
      accepted_by: 'api-lead',
    }, storage)();

    const reEsc = await escalationHandler.re_escalate({
      run_ref: 'run-3',
      step_ref: 'api',
      new_target: 'platform-team',
      reason: 'API team unable to resolve within SLA',
    }, storage)();

    if (E.isRight(reEsc) && reEsc.right.variant === 'ok') {
      expect(reEsc.right.escalation_count).toBe(2);
      expect(reEsc.right.new_target).toBe('platform-team');
    }
  });

  it('multiple re-escalations track escalation_count correctly', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-4',
      step_ref: 'critical',
      reason: 'System down',
      severity: 'critical',
      escalation_target: 'l1-support',
    }, storage)();

    for (let i = 2; i <= 5; i++) {
      const result = await escalationHandler.re_escalate({
        run_ref: 'run-4',
        step_ref: 'critical',
        new_target: `l${i}-support`,
        reason: `L${i - 1} unable to resolve`,
      }, storage)();

      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.escalation_count).toBe(i);
      }
    }
  });

  it('cannot accept from resolved state', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-5', step_ref: 's', reason: 'r', severity: 'low', escalation_target: 'team',
    }, storage)();
    await escalationHandler.accept({
      run_ref: 'run-5', step_ref: 's', accepted_by: 'alice',
    }, storage)();
    await escalationHandler.resolve({
      run_ref: 'run-5', step_ref: 's', resolution: 'Fixed', resolved_by: 'alice',
    }, storage)();

    const result = await escalationHandler.accept({
      run_ref: 'run-5', step_ref: 's', accepted_by: 'bob',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('cannot resolve from escalated state (must accept first)', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-6', step_ref: 'early', reason: 'r', severity: 'medium', escalation_target: 'team',
    }, storage)();

    const result = await escalationHandler.resolve({
      run_ref: 'run-6', step_ref: 'early', resolution: 'Attempted resolution', resolved_by: 'alice',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('cannot re-escalate from resolved state', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-7', step_ref: 'done', reason: 'r', severity: 'low', escalation_target: 'team-a',
    }, storage)();
    await escalationHandler.accept({
      run_ref: 'run-7', step_ref: 'done', accepted_by: 'alice',
    }, storage)();
    await escalationHandler.resolve({
      run_ref: 'run-7', step_ref: 'done', resolution: 'Fixed', resolved_by: 'alice',
    }, storage)();

    const result = await escalationHandler.re_escalate({
      run_ref: 'run-7', step_ref: 'done', new_target: 'team-b', reason: 'Reopen attempt',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('not_found returned for operations on non-existent escalation', async () => {
    const storage = createTestStorage();

    const accept = await escalationHandler.accept({
      run_ref: 'none', step_ref: 'none', accepted_by: 'x',
    }, storage)();
    if (E.isRight(accept)) expect(accept.right.variant).toBe('not_found');

    const resolve = await escalationHandler.resolve({
      run_ref: 'none', step_ref: 'none', resolution: 'r', resolved_by: 'x',
    }, storage)();
    if (E.isRight(resolve)) expect(resolve.right.variant).toBe('not_found');

    const reEsc = await escalationHandler.re_escalate({
      run_ref: 'none', step_ref: 'none', new_target: 't', reason: 'r',
    }, storage)();
    if (E.isRight(reEsc)) expect(reEsc.right.variant).toBe('not_found');
  });

  it('independent escalations on different steps do not interfere', async () => {
    const storage = createTestStorage();

    await escalationHandler.escalate({
      run_ref: 'run-9', step_ref: 'step-a', reason: 'A problem', severity: 'high', escalation_target: 'team-a',
    }, storage)();
    await escalationHandler.escalate({
      run_ref: 'run-9', step_ref: 'step-b', reason: 'B problem', severity: 'low', escalation_target: 'team-b',
    }, storage)();

    await escalationHandler.accept({
      run_ref: 'run-9', step_ref: 'step-a', accepted_by: 'alice',
    }, storage)();

    // step-a is accepted, step-b should still be escalated
    const acceptB = await escalationHandler.accept({
      run_ref: 'run-9', step_ref: 'step-b', accepted_by: 'bob',
    }, storage)();

    if (E.isRight(acceptB) && acceptB.right.variant === 'ok') {
      expect(acceptB.right.status).toBe('accepted');
    }
  });
});
