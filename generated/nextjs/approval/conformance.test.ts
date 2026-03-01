// Approval — conformance.test.ts
// Conformance tests for multi-party approval with configurable policies.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { approvalHandler } from './handler.js';
import type { ApprovalStorage } from './types.js';

// In-memory storage for conformance tests
const createTestStorage = (): ApprovalStorage => {
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

describe('Approval conformance', () => {
  it('request creates a pending approval', async () => {
    const storage = createTestStorage();
    const result = await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'review-gate',
      policy: 'all_of',
      required_count: 2,
      roles: ['manager', 'lead'],
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.status).toBe('pending');
    }
  });

  it('one_of policy: single approval transitions to approved', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'quick-check',
      policy: 'one_of',
      required_count: 1,
      roles: ['manager'],
    }, storage)();

    const result = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'quick-check',
      approver: 'alice',
      role: 'manager',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('approved');
    }
  });

  it('all_of policy: requires all approvals before transitioning', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'dual-sign',
      policy: 'all_of',
      required_count: 2,
      roles: ['manager', 'lead'],
    }, storage)();

    const r1 = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'dual-sign',
      approver: 'alice',
      role: 'manager',
    }, storage)();

    expect(E.isRight(r1)).toBe(true);
    if (E.isRight(r1)) {
      expect(r1.right.variant).toBe('pending');
      if (r1.right.variant === 'pending') {
        expect(r1.right.approvals_so_far).toBe(1);
        expect(r1.right.required_count).toBe(2);
      }
    }

    const r2 = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'dual-sign',
      approver: 'bob',
      role: 'lead',
    }, storage)();

    expect(E.isRight(r2)).toBe(true);
    if (E.isRight(r2)) {
      expect(r2.right.variant).toBe('approved');
    }
  });

  it('n_of_m policy: meets threshold at required_count', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'committee',
      policy: 'n_of_m',
      required_count: 2,
      roles: ['member-a', 'member-b', 'member-c'],
    }, storage)();

    await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'committee',
      approver: 'alice',
      role: 'member-a',
    }, storage)();

    const r2 = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'committee',
      approver: 'bob',
      role: 'member-b',
    }, storage)();

    expect(E.isRight(r2)).toBe(true);
    if (E.isRight(r2)) {
      expect(r2.right.variant).toBe('approved');
    }
  });

  it('deny transitions pending to denied', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'gate',
      policy: 'one_of',
      required_count: 1,
      roles: ['manager'],
    }, storage)();

    const result = await approvalHandler.deny({
      run_ref: 'run-1',
      step_ref: 'gate',
      approver: 'alice',
      role: 'manager',
      reason: 'Requirements not met',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('denied');
        expect(result.right.reason).toBe('Requirements not met');
      }
    }
  });

  it('request_changes transitions pending to changes_requested', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'pr-review',
      policy: 'one_of',
      required_count: 1,
      roles: ['reviewer'],
    }, storage)();

    const result = await approvalHandler.request_changes({
      run_ref: 'run-1',
      step_ref: 'pr-review',
      approver: 'alice',
      role: 'reviewer',
      feedback: 'Please fix the error handling',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('changes_requested');
        expect(result.right.feedback).toBe('Please fix the error handling');
      }
    }
  });

  it('timeout transitions pending to timed_out', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'deadline',
      policy: 'all_of',
      required_count: 3,
      roles: ['a', 'b', 'c'],
    }, storage)();

    const result = await approvalHandler.timeout({
      run_ref: 'run-1',
      step_ref: 'deadline',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('timed_out');
      }
    }
  });

  it('get_status returns current state and decisions', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'status-check',
      policy: 'all_of',
      required_count: 2,
      roles: ['a', 'b'],
    }, storage)();

    await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'status-check',
      approver: 'alice',
      role: 'a',
    }, storage)();

    const result = await approvalHandler.get_status({
      run_ref: 'run-1',
      step_ref: 'status-check',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('pending');
        expect(result.right.policy).toBe('all_of');
        expect(result.right.decisions).toHaveLength(1);
      }
    }
  });

  it('approve rejects when not in pending status', async () => {
    const storage = createTestStorage();
    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'closed',
      policy: 'one_of',
      required_count: 1,
      roles: ['manager'],
    }, storage)();
    await approvalHandler.deny({
      run_ref: 'run-1',
      step_ref: 'closed',
      approver: 'alice',
      role: 'manager',
      reason: 'No',
    }, storage)();

    const result = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'closed',
      approver: 'bob',
      role: 'manager',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });
});
