// Approval — business.test.ts
// Business logic tests for multi-party approval with configurable policies.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { approvalHandler } from './handler.js';
import type { ApprovalStorage } from './types.js';

const createTestStorage = (): ApprovalStorage => {
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

describe('Approval business logic', () => {
  it('n_of_m policy with 3 of 5: tracks progress and transitions at threshold', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-1',
      step_ref: 'committee-vote',
      policy: 'n_of_m',
      required_count: 3,
      roles: ['member-a', 'member-b', 'member-c', 'member-d', 'member-e'],
    }, storage)();

    // First approval: still pending
    const r1 = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'committee-vote',
      approver: 'alice',
      role: 'member-a',
    }, storage)();
    if (E.isRight(r1) && r1.right.variant === 'pending') {
      expect(r1.right.approvals_so_far).toBe(1);
      expect(r1.right.required_count).toBe(3);
    }

    // Second approval: still pending
    const r2 = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'committee-vote',
      approver: 'bob',
      role: 'member-b',
    }, storage)();
    if (E.isRight(r2) && r2.right.variant === 'pending') {
      expect(r2.right.approvals_so_far).toBe(2);
    }

    // Third approval: threshold met
    const r3 = await approvalHandler.approve({
      run_ref: 'run-1',
      step_ref: 'committee-vote',
      approver: 'charlie',
      role: 'member-c',
    }, storage)();
    expect(E.isRight(r3)).toBe(true);
    if (E.isRight(r3)) {
      expect(r3.right.variant).toBe('approved');
    }
  });

  it('deny immediately transitions regardless of accumulated approvals', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-2',
      step_ref: 'gate',
      policy: 'all_of',
      required_count: 3,
      roles: ['a', 'b', 'c'],
    }, storage)();

    // Two approvals in
    await approvalHandler.approve({
      run_ref: 'run-2', step_ref: 'gate', approver: 'alice', role: 'a',
    }, storage)();
    await approvalHandler.approve({
      run_ref: 'run-2', step_ref: 'gate', approver: 'bob', role: 'b',
    }, storage)();

    // Then a deny
    const result = await approvalHandler.deny({
      run_ref: 'run-2',
      step_ref: 'gate',
      approver: 'charlie',
      role: 'c',
      reason: 'Critical security issue found',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('denied');
      expect(result.right.reason).toBe('Critical security issue found');
    }
  });

  it('cannot approve after denial (terminal state)', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-3', step_ref: 'gate', policy: 'one_of', required_count: 1, roles: ['reviewer'],
    }, storage)();

    await approvalHandler.deny({
      run_ref: 'run-3', step_ref: 'gate', approver: 'alice', role: 'reviewer', reason: 'Denied',
    }, storage)();

    const result = await approvalHandler.approve({
      run_ref: 'run-3', step_ref: 'gate', approver: 'bob', role: 'reviewer',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('cannot deny after timeout', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-4', step_ref: 'deadline', policy: 'all_of', required_count: 2, roles: ['a', 'b'],
    }, storage)();

    await approvalHandler.timeout({ run_ref: 'run-4', step_ref: 'deadline' }, storage)();

    const result = await approvalHandler.deny({
      run_ref: 'run-4', step_ref: 'deadline', approver: 'alice', role: 'a', reason: 'late deny',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('cannot request_changes after approval', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-5', step_ref: 'pr', policy: 'one_of', required_count: 1, roles: ['reviewer'],
    }, storage)();

    await approvalHandler.approve({
      run_ref: 'run-5', step_ref: 'pr', approver: 'alice', role: 'reviewer',
    }, storage)();

    const result = await approvalHandler.request_changes({
      run_ref: 'run-5', step_ref: 'pr', approver: 'bob', role: 'reviewer', feedback: 'too late',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('get_status reflects accumulated decisions and current policy', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-6',
      step_ref: 'multi-gate',
      policy: 'all_of',
      required_count: 3,
      roles: ['lead', 'manager', 'security'],
    }, storage)();

    await approvalHandler.approve({
      run_ref: 'run-6', step_ref: 'multi-gate', approver: 'alice', role: 'lead',
    }, storage)();
    await approvalHandler.approve({
      run_ref: 'run-6', step_ref: 'multi-gate', approver: 'bob', role: 'manager',
    }, storage)();

    const status = await approvalHandler.get_status({
      run_ref: 'run-6', step_ref: 'multi-gate',
    }, storage)();

    if (E.isRight(status) && status.right.variant === 'ok') {
      expect(status.right.status).toBe('pending');
      expect(status.right.policy).toBe('all_of');
      expect(status.right.required_count).toBe(3);
      expect(status.right.decisions).toHaveLength(2);
      expect(status.right.decisions[0].approver).toBe('alice');
      expect(status.right.decisions[1].approver).toBe('bob');
    }
  });

  it('not_found returned for all operations on non-existent approval', async () => {
    const storage = createTestStorage();

    const approve = await approvalHandler.approve({
      run_ref: 'no', step_ref: 'no', approver: 'x', role: 'r',
    }, storage)();
    if (E.isRight(approve)) expect(approve.right.variant).toBe('not_found');

    const deny = await approvalHandler.deny({
      run_ref: 'no', step_ref: 'no', approver: 'x', role: 'r', reason: 'r',
    }, storage)();
    if (E.isRight(deny)) expect(deny.right.variant).toBe('not_found');

    const rc = await approvalHandler.request_changes({
      run_ref: 'no', step_ref: 'no', approver: 'x', role: 'r', feedback: 'f',
    }, storage)();
    if (E.isRight(rc)) expect(rc.right.variant).toBe('not_found');

    const timeout = await approvalHandler.timeout({ run_ref: 'no', step_ref: 'no' }, storage)();
    if (E.isRight(timeout)) expect(timeout.right.variant).toBe('not_found');

    const status = await approvalHandler.get_status({ run_ref: 'no', step_ref: 'no' }, storage)();
    if (E.isRight(status)) expect(status.right.variant).toBe('not_found');
  });

  it('changes_requested is a terminal state that blocks further approvals', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-8', step_ref: 'cr', policy: 'all_of', required_count: 2, roles: ['a', 'b'],
    }, storage)();

    await approvalHandler.request_changes({
      run_ref: 'run-8', step_ref: 'cr', approver: 'alice', role: 'a', feedback: 'Fix errors',
    }, storage)();

    const approveResult = await approvalHandler.approve({
      run_ref: 'run-8', step_ref: 'cr', approver: 'bob', role: 'b',
    }, storage)();

    if (E.isRight(approveResult)) {
      expect(approveResult.right.variant).toBe('invalid_status');
    }
  });

  it('multiple independent approvals track different step_refs', async () => {
    const storage = createTestStorage();

    await approvalHandler.request({
      run_ref: 'run-9', step_ref: 'gate-a', policy: 'one_of', required_count: 1, roles: ['r'],
    }, storage)();
    await approvalHandler.request({
      run_ref: 'run-9', step_ref: 'gate-b', policy: 'one_of', required_count: 1, roles: ['r'],
    }, storage)();

    await approvalHandler.approve({
      run_ref: 'run-9', step_ref: 'gate-a', approver: 'alice', role: 'r',
    }, storage)();

    const statusA = await approvalHandler.get_status({ run_ref: 'run-9', step_ref: 'gate-a' }, storage)();
    const statusB = await approvalHandler.get_status({ run_ref: 'run-9', step_ref: 'gate-b' }, storage)();

    if (E.isRight(statusA) && statusA.right.variant === 'ok') expect(statusA.right.status).toBe('approved');
    if (E.isRight(statusB) && statusB.right.variant === 'ok') expect(statusB.right.status).toBe('pending');
  });
});
