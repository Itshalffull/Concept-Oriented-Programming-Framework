// Escalation — conformance.test.ts
// Conformance tests for escalation lifecycle with severity tracking and re-escalation.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { escalationHandler } from './handler.js';
import type { EscalationStorage } from './types.js';

// In-memory storage for conformance tests
const createTestStorage = (): EscalationStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

describe('Escalation conformance', () => {
  it('escalate creates an escalation in escalated status', async () => {
    const storage = createTestStorage();
    const result = await escalationHandler.escalate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'SLA breach',
      severity: 3,
      escalation_target: 'manager-group',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.status).toBe('escalated');
      expect(result.right.severity).toBe(3);
    }
  });

  it('accept transitions escalated -> accepted', async () => {
    const storage = createTestStorage();
    await escalationHandler.escalate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'Timeout',
      severity: 2,
      escalation_target: 'ops-team',
    }, storage)();

    const result = await escalationHandler.accept({
      run_ref: 'run-1',
      step_ref: 'step-1',
      accepted_by: 'alice',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('accepted');
        expect(result.right.accepted_by).toBe('alice');
      }
    }
  });

  it('resolve transitions accepted -> resolved', async () => {
    const storage = createTestStorage();
    await escalationHandler.escalate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'Error',
      severity: 1,
      escalation_target: 'devs',
    }, storage)();
    await escalationHandler.accept({
      run_ref: 'run-1',
      step_ref: 'step-1',
      accepted_by: 'bob',
    }, storage)();

    const result = await escalationHandler.resolve({
      run_ref: 'run-1',
      step_ref: 'step-1',
      resolution: 'Applied hotfix',
      resolved_by: 'bob',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('resolved');
        expect(result.right.resolution).toBe('Applied hotfix');
      }
    }
  });

  it('resolve rejects when not in accepted status', async () => {
    const storage = createTestStorage();
    await escalationHandler.escalate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'Error',
      severity: 1,
      escalation_target: 'devs',
    }, storage)();

    const result = await escalationHandler.resolve({
      run_ref: 'run-1',
      step_ref: 'step-1',
      resolution: 'Fixed',
      resolved_by: 'alice',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('re_escalate transitions back to escalated with new target', async () => {
    const storage = createTestStorage();
    await escalationHandler.escalate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'Initial issue',
      severity: 2,
      escalation_target: 'team-a',
    }, storage)();
    await escalationHandler.accept({
      run_ref: 'run-1',
      step_ref: 'step-1',
      accepted_by: 'alice',
    }, storage)();

    const result = await escalationHandler.re_escalate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'Needs higher authority',
      new_target: 'team-b',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('escalated');
        expect(result.right.new_target).toBe('team-b');
        expect(result.right.escalation_count).toBe(2);
      }
    }
  });

  it('full lifecycle: escalate -> accept -> resolve', async () => {
    const storage = createTestStorage();

    const r1 = await escalationHandler.escalate({
      run_ref: 'run-2',
      step_ref: 'alert',
      reason: 'Critical failure',
      severity: 5,
      escalation_target: 'on-call',
      context: { service: 'payment' },
    }, storage)();
    expect(E.isRight(r1)).toBe(true);

    const r2 = await escalationHandler.accept({
      run_ref: 'run-2',
      step_ref: 'alert',
      accepted_by: 'on-call-engineer',
    }, storage)();
    expect(E.isRight(r2)).toBe(true);
    if (E.isRight(r2)) expect(r2.right.variant).toBe('ok');

    const r3 = await escalationHandler.resolve({
      run_ref: 'run-2',
      step_ref: 'alert',
      resolution: 'Restarted service and deployed fix',
      resolved_by: 'on-call-engineer',
    }, storage)();
    expect(E.isRight(r3)).toBe(true);
    if (E.isRight(r3)) {
      expect(r3.right.variant).toBe('ok');
      if (r3.right.variant === 'ok') {
        expect(r3.right.status).toBe('resolved');
      }
    }
  });
});
