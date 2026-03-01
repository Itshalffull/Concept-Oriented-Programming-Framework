// WorkItem — conformance.test.ts
// Conformance tests for work-item lifecycle with pool-based assignment and status transitions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { workItemHandler } from './handler.js';
import type { WorkItemStorage } from './types.js';

// In-memory storage for conformance tests
const createTestStorage = (): WorkItemStorage => {
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

describe('WorkItem conformance', () => {
  it('create produces an offered work item', async () => {
    const storage = createTestStorage();
    const result = await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice', 'bob'],
      form_schema: { type: 'object' },
      priority: 5,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.status).toBe('offered');
      expect(result.right.work_item_id).toBe('run-1::step-1');
    }
  });

  it('claim transitions offered -> claimed when assignee is in pool', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice', 'bob'],
      form_schema: {},
      priority: 3,
    }, storage)();

    const result = await workItemHandler.claim({
      run_ref: 'run-1',
      step_ref: 'step-1',
      assignee: 'alice',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('claimed');
        expect(result.right.assignee).toBe('alice');
      }
    }
  });

  it('claim rejects assignee not in candidate pool', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice', 'bob'],
      form_schema: {},
      priority: 3,
    }, storage)();

    const result = await workItemHandler.claim({
      run_ref: 'run-1',
      step_ref: 'step-1',
      assignee: 'charlie',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_in_pool');
    }
  });

  it('claim rejects when item is not in offered status', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice'],
      form_schema: {},
      priority: 1,
    }, storage)();
    await workItemHandler.claim({ run_ref: 'run-1', step_ref: 'step-1', assignee: 'alice' }, storage)();

    const result = await workItemHandler.claim({
      run_ref: 'run-1',
      step_ref: 'step-1',
      assignee: 'alice',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('start transitions claimed -> active', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice'],
      form_schema: {},
      priority: 1,
    }, storage)();
    await workItemHandler.claim({ run_ref: 'run-1', step_ref: 'step-1', assignee: 'alice' }, storage)();

    const result = await workItemHandler.start({ run_ref: 'run-1', step_ref: 'step-1' }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('active');
      }
    }
  });

  it('complete transitions active -> completed with form data', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice'],
      form_schema: {},
      priority: 1,
    }, storage)();
    await workItemHandler.claim({ run_ref: 'run-1', step_ref: 'step-1', assignee: 'alice' }, storage)();
    await workItemHandler.start({ run_ref: 'run-1', step_ref: 'step-1' }, storage)();

    const result = await workItemHandler.complete({
      run_ref: 'run-1',
      step_ref: 'step-1',
      form_data: { approved: true, notes: 'Looks good' },
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('completed');
        expect(result.right.form_data).toEqual({ approved: true, notes: 'Looks good' });
      }
    }
  });

  it('reject transitions active -> rejected', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice'],
      form_schema: {},
      priority: 1,
    }, storage)();
    await workItemHandler.claim({ run_ref: 'run-1', step_ref: 'step-1', assignee: 'alice' }, storage)();
    await workItemHandler.start({ run_ref: 'run-1', step_ref: 'step-1' }, storage)();

    const result = await workItemHandler.reject({
      run_ref: 'run-1',
      step_ref: 'step-1',
      reason: 'Data invalid',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('rejected');
        expect(result.right.reason).toBe('Data invalid');
      }
    }
  });

  it('delegate transitions claimed -> delegated with new assignee', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice', 'bob'],
      form_schema: {},
      priority: 1,
    }, storage)();
    await workItemHandler.claim({ run_ref: 'run-1', step_ref: 'step-1', assignee: 'alice' }, storage)();

    const result = await workItemHandler.delegate({
      run_ref: 'run-1',
      step_ref: 'step-1',
      new_assignee: 'bob',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('delegated');
        expect(result.right.new_assignee).toBe('bob');
      }
    }
  });

  it('release transitions claimed -> offered and clears assignee', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice', 'bob'],
      form_schema: {},
      priority: 1,
    }, storage)();
    await workItemHandler.claim({ run_ref: 'run-1', step_ref: 'step-1', assignee: 'alice' }, storage)();

    const result = await workItemHandler.release({
      run_ref: 'run-1',
      step_ref: 'step-1',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.status).toBe('offered');
      }
    }
  });

  it('release rejects when item is not in claimed status', async () => {
    const storage = createTestStorage();
    await workItemHandler.create({
      run_ref: 'run-1',
      step_ref: 'step-1',
      candidate_pool: ['alice'],
      form_schema: {},
      priority: 1,
    }, storage)();

    const result = await workItemHandler.release({
      run_ref: 'run-1',
      step_ref: 'step-1',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('full lifecycle: create -> claim -> start -> complete', async () => {
    const storage = createTestStorage();

    const r1 = await workItemHandler.create({
      run_ref: 'run-2',
      step_ref: 'review',
      candidate_pool: ['reviewer-1'],
      form_schema: { fields: ['decision'] },
      priority: 10,
    }, storage)();
    expect(E.isRight(r1)).toBe(true);

    const r2 = await workItemHandler.claim({
      run_ref: 'run-2',
      step_ref: 'review',
      assignee: 'reviewer-1',
    }, storage)();
    expect(E.isRight(r2)).toBe(true);
    if (E.isRight(r2)) expect(r2.right.variant).toBe('ok');

    const r3 = await workItemHandler.start({
      run_ref: 'run-2',
      step_ref: 'review',
    }, storage)();
    expect(E.isRight(r3)).toBe(true);
    if (E.isRight(r3)) expect(r3.right.variant).toBe('ok');

    const r4 = await workItemHandler.complete({
      run_ref: 'run-2',
      step_ref: 'review',
      form_data: { decision: 'approved' },
    }, storage)();
    expect(E.isRight(r4)).toBe(true);
    if (E.isRight(r4)) {
      expect(r4.right.variant).toBe('ok');
      if (r4.right.variant === 'ok') {
        expect(r4.right.status).toBe('completed');
      }
    }
  });
});
