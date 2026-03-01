// Milestone — business.test.ts
// Business logic tests for process milestones with condition-based evaluation and revocation.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { milestoneHandler } from './handler.js';
import type { MilestoneStorage } from './types.js';

const createTestStorage = (): MilestoneStorage => {
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

describe('Milestone business logic', () => {
  it('define -> evaluate with matching condition -> achieved', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-1',
      name: 'Order Shipped',
      description: 'All items have been shipped',
      condition: '{"shipped":true}',
    }, storage)();

    const result = await milestoneHandler.evaluate({
      milestone_id: 'ms-1',
      context: '{"shipped":true,"tracking":"TR-123"}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('achieved');
      if (result.right.variant === 'achieved') {
        expect(result.right.achieved_at).toBeTruthy();
      }
    }
  });

  it('evaluate with non-matching condition returns not_yet', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-2',
      name: 'Payment Received',
      description: 'Full payment received',
      condition: '{"paid":true,"amount":100}',
    }, storage)();

    const result = await milestoneHandler.evaluate({
      milestone_id: 'ms-2',
      context: '{"paid":false,"amount":50}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_yet');
    }
  });

  it('numeric condition uses >= comparison', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-3',
      name: 'Threshold Met',
      description: 'Score above 80',
      condition: '{"score":80}',
    }, storage)();

    // Exact match
    const result1 = await milestoneHandler.evaluate({
      milestone_id: 'ms-3',
      context: '{"score":80}',
    }, storage)();
    if (E.isRight(result1)) {
      expect(result1.right.variant).toBe('achieved');
    }
  });

  it('numeric condition: value above threshold achieves milestone', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-4',
      name: 'High Score',
      description: 'Score must be at least 50',
      condition: '{"score":50}',
    }, storage)();

    const result = await milestoneHandler.evaluate({
      milestone_id: 'ms-4',
      context: '{"score":100}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('achieved');
    }
  });

  it('numeric condition: value below threshold returns not_yet', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-5',
      name: 'Low Score',
      description: 'Score must be at least 50',
      condition: '{"score":50}',
    }, storage)();

    const result = await milestoneHandler.evaluate({
      milestone_id: 'ms-5',
      context: '{"score":30}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_yet');
    }
  });

  it('evaluate already-achieved milestone returns already_achieved', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-6',
      name: 'Done',
      description: 'Completed',
      condition: '{"done":true}',
    }, storage)();

    await milestoneHandler.evaluate({
      milestone_id: 'ms-6',
      context: '{"done":true}',
    }, storage)();

    const result = await milestoneHandler.evaluate({
      milestone_id: 'ms-6',
      context: '{"done":true}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('already_achieved');
    }
  });

  it('revoke achieved milestone returns to pending', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-7',
      name: 'Approval',
      description: 'Approved by manager',
      condition: '{"approved":true}',
    }, storage)();

    await milestoneHandler.evaluate({
      milestone_id: 'ms-7',
      context: '{"approved":true}',
    }, storage)();

    const result = await milestoneHandler.revoke({
      milestone_id: 'ms-7',
      reason: 'Approval withdrawn due to policy change',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }

    // After revoke, evaluate can achieve again
    const reEval = await milestoneHandler.evaluate({
      milestone_id: 'ms-7',
      context: '{"approved":true}',
    }, storage)();

    if (E.isRight(reEval)) {
      expect(reEval.right.variant).toBe('achieved');
    }
  });

  it('revoke pending milestone returns invalid_status', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-8',
      name: 'Not Yet',
      description: 'Not achieved',
      condition: '{"x":true}',
    }, storage)();

    const result = await milestoneHandler.revoke({
      milestone_id: 'ms-8',
      reason: 'Cannot revoke pending',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('not_found for evaluate and revoke on non-existent milestone', async () => {
    const storage = createTestStorage();

    const evalResult = await milestoneHandler.evaluate({
      milestone_id: 'ghost',
      context: '{}',
    }, storage)();
    if (E.isRight(evalResult)) expect(evalResult.right.variant).toBe('not_found');

    const revokeResult = await milestoneHandler.revoke({
      milestone_id: 'ghost',
      reason: 'n/a',
    }, storage)();
    if (E.isRight(revokeResult)) expect(revokeResult.right.variant).toBe('not_found');
  });

  it('multi-key condition requires all keys to match', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-10',
      name: 'Full Check',
      description: 'Requires multiple conditions',
      condition: '{"status":"active","level":5,"verified":true}',
    }, storage)();

    // Missing one key
    const partial = await milestoneHandler.evaluate({
      milestone_id: 'ms-10',
      context: '{"status":"active","level":5,"verified":false}',
    }, storage)();
    if (E.isRight(partial)) {
      expect(partial.right.variant).toBe('not_yet');
    }

    // All keys match
    const full = await milestoneHandler.evaluate({
      milestone_id: 'ms-10',
      context: '{"status":"active","level":5,"verified":true}',
    }, storage)();
    if (E.isRight(full)) {
      expect(full.right.variant).toBe('achieved');
    }
  });

  it('invalid JSON context returns not_yet (graceful handling)', async () => {
    const storage = createTestStorage();

    await milestoneHandler.define({
      milestone_id: 'ms-11',
      name: 'JSON Test',
      description: 'Test invalid JSON',
      condition: '{"key":"value"}',
    }, storage)();

    const result = await milestoneHandler.evaluate({
      milestone_id: 'ms-11',
      context: 'not-valid-json',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_yet');
    }
  });
});
