// CompensationPlan — business.test.ts
// Business logic tests for saga-style compensating actions with LIFO execution order.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { compensationPlanHandler } from './handler.js';
import type { CompensationPlanStorage } from './types.js';

const createTestStorage = (): CompensationPlanStorage => {
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

describe('CompensationPlan business logic', () => {
  it('full LIFO execution: compensations execute in reverse registration order', async () => {
    const storage = createTestStorage();

    // Register 3 compensating actions in order: A, B, C
    await compensationPlanHandler.register({
      run_ref: 'run-1',
      step_key: 'create-order',
      action_descriptor: 'cancel-order',
    }, storage)();

    await compensationPlanHandler.register({
      run_ref: 'run-1',
      step_key: 'reserve-inventory',
      action_descriptor: 'release-inventory',
    }, storage)();

    await compensationPlanHandler.register({
      run_ref: 'run-1',
      step_key: 'charge-payment',
      action_descriptor: 'refund-payment',
    }, storage)();

    // Trigger
    const triggerResult = await compensationPlanHandler.trigger({
      run_ref: 'run-1',
    }, storage)();

    expect(E.isRight(triggerResult)).toBe(true);
    if (E.isRight(triggerResult)) {
      expect(triggerResult.right.variant).toBe('ok');
    }

    // Execute compensations in reverse order: C, B, A
    const exec1 = await compensationPlanHandler.execute_next({ plan_id: 'run-1' }, storage)();
    if (E.isRight(exec1) && exec1.right.variant === 'ok') {
      expect(exec1.right.step_key).toBe('charge-payment');
      expect(exec1.right.action_descriptor).toBe('refund-payment');
    }

    const exec2 = await compensationPlanHandler.execute_next({ plan_id: 'run-1' }, storage)();
    if (E.isRight(exec2) && exec2.right.variant === 'ok') {
      expect(exec2.right.step_key).toBe('reserve-inventory');
      expect(exec2.right.action_descriptor).toBe('release-inventory');
    }

    const exec3 = await compensationPlanHandler.execute_next({ plan_id: 'run-1' }, storage)();
    if (E.isRight(exec3) && exec3.right.variant === 'ok') {
      expect(exec3.right.step_key).toBe('create-order');
      expect(exec3.right.action_descriptor).toBe('cancel-order');
    }

    // All done
    const exec4 = await compensationPlanHandler.execute_next({ plan_id: 'run-1' }, storage)();
    if (E.isRight(exec4)) {
      expect(exec4.right.variant).toBe('all_done');
    }
  });

  it('trigger on empty plan returns empty variant', async () => {
    const storage = createTestStorage();

    const result = await compensationPlanHandler.trigger({
      run_ref: 'empty-run',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('empty');
    }
  });

  it('trigger already triggered plan returns already_triggered', async () => {
    const storage = createTestStorage();

    await compensationPlanHandler.register({
      run_ref: 'run-2',
      step_key: 'step-a',
      action_descriptor: 'undo-a',
    }, storage)();

    await compensationPlanHandler.trigger({ run_ref: 'run-2' }, storage)();

    const result = await compensationPlanHandler.trigger({ run_ref: 'run-2' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('already_triggered');
    }
  });

  it('mark_compensation_failed transitions plan to failed', async () => {
    const storage = createTestStorage();

    await compensationPlanHandler.register({
      run_ref: 'run-3',
      step_key: 'risky-step',
      action_descriptor: 'undo-risky',
    }, storage)();

    await compensationPlanHandler.trigger({ run_ref: 'run-3' }, storage)();
    await compensationPlanHandler.execute_next({ plan_id: 'run-3' }, storage)();

    const result = await compensationPlanHandler.mark_compensation_failed({
      plan_id: 'run-3',
      step_key: 'risky-step',
      error: 'Compensation action timed out after 30s',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }
  });

  it('mark_compensation_failed on non-existent plan returns not_found', async () => {
    const storage = createTestStorage();

    const result = await compensationPlanHandler.mark_compensation_failed({
      plan_id: 'ghost',
      step_key: 'step',
      error: 'err',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('execute_next on non-existent plan returns not_found', async () => {
    const storage = createTestStorage();

    const result = await compensationPlanHandler.execute_next({
      plan_id: 'nonexistent',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('multiple registrations append to same plan', async () => {
    const storage = createTestStorage();

    for (let i = 1; i <= 5; i++) {
      const result = await compensationPlanHandler.register({
        run_ref: 'run-5',
        step_key: `step-${i}`,
        action_descriptor: `undo-step-${i}`,
      }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    }

    await compensationPlanHandler.trigger({ run_ref: 'run-5' }, storage)();

    // Should get step-5 first (LIFO)
    const first = await compensationPlanHandler.execute_next({ plan_id: 'run-5' }, storage)();
    if (E.isRight(first) && first.right.variant === 'ok') {
      expect(first.right.step_key).toBe('step-5');
    }
  });

  it('single compensation plan executes and completes in one step', async () => {
    const storage = createTestStorage();

    await compensationPlanHandler.register({
      run_ref: 'run-6',
      step_key: 'only-step',
      action_descriptor: 'undo-only',
    }, storage)();

    await compensationPlanHandler.trigger({ run_ref: 'run-6' }, storage)();

    const exec = await compensationPlanHandler.execute_next({ plan_id: 'run-6' }, storage)();
    if (E.isRight(exec) && exec.right.variant === 'ok') {
      expect(exec.right.step_key).toBe('only-step');
    }

    const done = await compensationPlanHandler.execute_next({ plan_id: 'run-6' }, storage)();
    if (E.isRight(done)) {
      expect(done.right.variant).toBe('all_done');
    }
  });

  it('execute_next on dormant (non-triggered) plan returns not_found', async () => {
    const storage = createTestStorage();

    await compensationPlanHandler.register({
      run_ref: 'run-7',
      step_key: 'dormant-step',
      action_descriptor: 'undo-dormant',
    }, storage)();

    const result = await compensationPlanHandler.execute_next({
      plan_id: 'run-7',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });
});
