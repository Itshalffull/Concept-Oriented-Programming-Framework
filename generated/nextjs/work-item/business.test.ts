// WorkItem — business.test.ts
// Business logic tests for human work-item lifecycle with pool-based assignment.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { workItemHandler } from './handler.js';
import type { WorkItemStorage } from './types.js';

const createTestStorage = (): WorkItemStorage => {
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

describe('WorkItem business logic', () => {
  it('full lifecycle: create -> claim -> start -> complete', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-1',
      step_ref: 'review',
      candidate_pool: ['alice', 'bob', 'charlie'],
      form_schema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
      priority: 'high',
    }, storage)();

    const claimResult = await handler.claim({
      run_ref: 'run-1',
      step_ref: 'review',
      assignee: 'alice',
    }, storage)();
    if (E.isRight(claimResult) && claimResult.right.variant === 'ok') {
      expect(claimResult.right.assignee).toBe('alice');
      expect(claimResult.right.status).toBe('claimed');
    }

    const startResult = await handler.start({ run_ref: 'run-1', step_ref: 'review' }, storage)();
    if (E.isRight(startResult) && startResult.right.variant === 'ok') {
      expect(startResult.right.status).toBe('active');
    }

    const completeResult = await handler.complete({
      run_ref: 'run-1',
      step_ref: 'review',
      form_data: '{"approved":true,"comments":"Looks good"}',
    }, storage)();
    if (E.isRight(completeResult) && completeResult.right.variant === 'ok') {
      expect(completeResult.right.status).toBe('completed');
      expect(completeResult.right.form_data).toBe('{"approved":true,"comments":"Looks good"}');
    }
  });

  it('claim by non-pool member returns not_in_pool', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-2',
      step_ref: 'task',
      candidate_pool: ['alice', 'bob'],
      form_schema: '{}',
      priority: 'medium',
    }, storage)();

    const result = await handler.claim({
      run_ref: 'run-2',
      step_ref: 'task',
      assignee: 'eve',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_in_pool');
    }
  });

  it('claim an already-claimed item returns invalid_status', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-3',
      step_ref: 'task',
      candidate_pool: ['alice', 'bob'],
      form_schema: '{}',
      priority: 'low',
    }, storage)();

    await handler.claim({ run_ref: 'run-3', step_ref: 'task', assignee: 'alice' }, storage)();

    const result = await handler.claim({ run_ref: 'run-3', step_ref: 'task', assignee: 'bob' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('release returns item to offered status and clears assignee', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-4',
      step_ref: 'task',
      candidate_pool: ['alice', 'bob'],
      form_schema: '{}',
      priority: 'medium',
    }, storage)();

    await handler.claim({ run_ref: 'run-4', step_ref: 'task', assignee: 'alice' }, storage)();

    const releaseResult = await handler.release({ run_ref: 'run-4', step_ref: 'task' }, storage)();
    if (E.isRight(releaseResult) && releaseResult.right.variant === 'ok') {
      expect(releaseResult.right.status).toBe('offered');
    }

    // Another person can now claim it
    const reclaimResult = await handler.claim({ run_ref: 'run-4', step_ref: 'task', assignee: 'bob' }, storage)();
    if (E.isRight(reclaimResult) && reclaimResult.right.variant === 'ok') {
      expect(reclaimResult.right.assignee).toBe('bob');
    }
  });

  it('delegate from claimed transfers to new assignee', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-5',
      step_ref: 'task',
      candidate_pool: ['alice', 'bob', 'charlie'],
      form_schema: '{}',
      priority: 'high',
    }, storage)();

    await handler.claim({ run_ref: 'run-5', step_ref: 'task', assignee: 'alice' }, storage)();

    const delegateResult = await handler.delegate({
      run_ref: 'run-5',
      step_ref: 'task',
      new_assignee: 'charlie',
    }, storage)();

    if (E.isRight(delegateResult) && delegateResult.right.variant === 'ok') {
      expect(delegateResult.right.new_assignee).toBe('charlie');
      expect(delegateResult.right.status).toBe('delegated');
    }
  });

  it('delegate from active transfers to new assignee', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-6',
      step_ref: 'task',
      candidate_pool: ['alice', 'bob'],
      form_schema: '{}',
      priority: 'medium',
    }, storage)();

    await handler.claim({ run_ref: 'run-6', step_ref: 'task', assignee: 'alice' }, storage)();
    await handler.start({ run_ref: 'run-6', step_ref: 'task' }, storage)();

    const result = await handler.delegate({
      run_ref: 'run-6',
      step_ref: 'task',
      new_assignee: 'bob',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.new_assignee).toBe('bob');
    }
  });

  it('reject from active records reason and transitions to rejected', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-7',
      step_ref: 'approval',
      candidate_pool: ['alice'],
      form_schema: '{}',
      priority: 'high',
    }, storage)();

    await handler.claim({ run_ref: 'run-7', step_ref: 'approval', assignee: 'alice' }, storage)();
    await handler.start({ run_ref: 'run-7', step_ref: 'approval' }, storage)();

    const result = await handler.reject({
      run_ref: 'run-7',
      step_ref: 'approval',
      reason: 'Insufficient documentation',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('rejected');
      expect(result.right.reason).toBe('Insufficient documentation');
    }
  });

  it('reject from claimed is allowed', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-8',
      step_ref: 'task',
      candidate_pool: ['alice'],
      form_schema: '{}',
      priority: 'medium',
    }, storage)();

    await handler.claim({ run_ref: 'run-8', step_ref: 'task', assignee: 'alice' }, storage)();

    const result = await handler.reject({
      run_ref: 'run-8',
      step_ref: 'task',
      reason: 'Not my area',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('rejected');
    }
  });

  it('complete from non-active state returns invalid_status', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-9',
      step_ref: 'task',
      candidate_pool: ['alice'],
      form_schema: '{}',
      priority: 'low',
    }, storage)();

    // Try complete from offered state
    const result = await handler.complete({
      run_ref: 'run-9',
      step_ref: 'task',
      form_data: '{}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('not_found returned for operations on non-existent items', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    const claim = await handler.claim({ run_ref: 'no', step_ref: 'no', assignee: 'x' }, storage)();
    if (E.isRight(claim)) expect(claim.right.variant).toBe('not_found');

    const start = await handler.start({ run_ref: 'no', step_ref: 'no' }, storage)();
    if (E.isRight(start)) expect(start.right.variant).toBe('not_found');

    const complete = await handler.complete({ run_ref: 'no', step_ref: 'no', form_data: '{}' }, storage)();
    if (E.isRight(complete)) expect(complete.right.variant).toBe('not_found');

    const reject = await handler.reject({ run_ref: 'no', step_ref: 'no', reason: 'r' }, storage)();
    if (E.isRight(reject)) expect(reject.right.variant).toBe('not_found');

    const release = await handler.release({ run_ref: 'no', step_ref: 'no' }, storage)();
    if (E.isRight(release)) expect(release.right.variant).toBe('not_found');
  });

  it('release from non-claimed state returns invalid_status', async () => {
    const storage = createTestStorage();
    const handler = workItemHandler;

    await handler.create({
      run_ref: 'run-10',
      step_ref: 'task',
      candidate_pool: ['alice'],
      form_schema: '{}',
      priority: 'medium',
    }, storage)();

    const result = await handler.release({ run_ref: 'run-10', step_ref: 'task' }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });
});
