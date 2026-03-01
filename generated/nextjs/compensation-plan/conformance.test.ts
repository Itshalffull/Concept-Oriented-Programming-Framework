// CompensationPlan — conformance.test.ts
// Conformance tests for saga-style compensation with LIFO execution order.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

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

describe('CompensationPlan conformance', () => {
  it('invariant: register creates a dormant plan and appends compensations', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    const r1 = await handler.register({
      run_ref: 'run-1',
      step_key: 'charge_payment',
      action_descriptor: 'refund_payment',
    }, storage)();

    expect(E.isRight(r1)).toBe(true);
    if (E.isRight(r1)) {
      expect(r1.right.variant).toBe('ok');
    }

    // Register second compensation
    const r2 = await handler.register({
      run_ref: 'run-1',
      step_key: 'reserve_inventory',
      action_descriptor: 'release_inventory',
    }, storage)();

    expect(E.isRight(r2)).toBe(true);
    if (E.isRight(r2)) {
      expect(r2.right.variant).toBe('ok');
    }
  });

  it('invariant: trigger transitions dormant to triggered', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    await handler.register({ run_ref: 'run-2', step_key: 's1', action_descriptor: 'undo_s1' }, storage)();
    await handler.register({ run_ref: 'run-2', step_key: 's2', action_descriptor: 'undo_s2' }, storage)();

    const result = await handler.trigger({ run_ref: 'run-2' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }
  });

  it('invariant: trigger returns empty when no compensations registered', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    const result = await handler.trigger({ run_ref: 'run-empty' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('empty');
    }
  });

  it('invariant: trigger returns already_triggered on second trigger', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    await handler.register({ run_ref: 'run-3', step_key: 's1', action_descriptor: 'undo_s1' }, storage)();
    await handler.trigger({ run_ref: 'run-3' }, storage)();

    const result = await handler.trigger({ run_ref: 'run-3' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('already_triggered');
    }
  });

  it('invariant: execute_next returns compensations in LIFO (reverse) order', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    // Register 3 compensations in order: s1, s2, s3
    await handler.register({ run_ref: 'run-4', step_key: 's1', action_descriptor: 'undo_s1' }, storage)();
    await handler.register({ run_ref: 'run-4', step_key: 's2', action_descriptor: 'undo_s2' }, storage)();
    await handler.register({ run_ref: 'run-4', step_key: 's3', action_descriptor: 'undo_s3' }, storage)();

    await handler.trigger({ run_ref: 'run-4' }, storage)();

    // First execute_next should return s3 (last registered, LIFO)
    const exec1 = await handler.execute_next({ plan_id: 'run-4' }, storage)();
    expect(E.isRight(exec1)).toBe(true);
    if (E.isRight(exec1)) {
      expect(exec1.right.variant).toBe('ok');
      if (exec1.right.variant === 'ok') {
        expect(exec1.right.step_key).toBe('s3');
        expect(exec1.right.action_descriptor).toBe('undo_s3');
      }
    }

    // Second execute_next should return s2
    const exec2 = await handler.execute_next({ plan_id: 'run-4' }, storage)();
    expect(E.isRight(exec2)).toBe(true);
    if (E.isRight(exec2) && exec2.right.variant === 'ok') {
      expect(exec2.right.step_key).toBe('s2');
      expect(exec2.right.action_descriptor).toBe('undo_s2');
    }

    // Third execute_next should return s1
    const exec3 = await handler.execute_next({ plan_id: 'run-4' }, storage)();
    expect(E.isRight(exec3)).toBe(true);
    if (E.isRight(exec3) && exec3.right.variant === 'ok') {
      expect(exec3.right.step_key).toBe('s1');
      expect(exec3.right.action_descriptor).toBe('undo_s1');
    }

    // Fourth execute_next should return all_done
    const exec4 = await handler.execute_next({ plan_id: 'run-4' }, storage)();
    expect(E.isRight(exec4)).toBe(true);
    if (E.isRight(exec4)) {
      expect(exec4.right.variant).toBe('all_done');
    }
  });

  it('invariant: execute_next returns not_found for unknown plan', async () => {
    const storage = createTestStorage();
    const result = await compensationPlanHandler.execute_next({ plan_id: 'nonexistent' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('invariant: mark_compensation_failed transitions plan to failed', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    await handler.register({ run_ref: 'run-5', step_key: 's1', action_descriptor: 'undo_s1' }, storage)();
    await handler.register({ run_ref: 'run-5', step_key: 's2', action_descriptor: 'undo_s2' }, storage)();
    await handler.trigger({ run_ref: 'run-5' }, storage)();

    // Execute first compensation
    await handler.execute_next({ plan_id: 'run-5' }, storage)();

    // Mark it as failed
    const result = await handler.mark_compensation_failed({
      plan_id: 'run-5',
      step_key: 's2',
      error: 'refund_service_unavailable',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }
  });

  it('invariant: mark_compensation_failed returns not_found for unknown plan', async () => {
    const storage = createTestStorage();
    const result = await compensationPlanHandler.mark_compensation_failed({
      plan_id: 'nonexistent',
      step_key: 's1',
      error: 'err',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('invariant: full lifecycle register -> trigger -> execute_next (all) -> completed', async () => {
    const storage = createTestStorage();
    const handler = compensationPlanHandler;

    await handler.register({ run_ref: 'run-6', step_key: 'debit', action_descriptor: 'credit' }, storage)();
    await handler.register({ run_ref: 'run-6', step_key: 'ship', action_descriptor: 'cancel_shipment' }, storage)();

    await handler.trigger({ run_ref: 'run-6' }, storage)();

    // Execute all compensations
    const exec1 = await handler.execute_next({ plan_id: 'run-6' }, storage)();
    expect(E.isRight(exec1)).toBe(true);
    if (E.isRight(exec1) && exec1.right.variant === 'ok') {
      expect(exec1.right.step_key).toBe('ship');
    }

    const exec2 = await handler.execute_next({ plan_id: 'run-6' }, storage)();
    expect(E.isRight(exec2)).toBe(true);
    if (E.isRight(exec2) && exec2.right.variant === 'ok') {
      expect(exec2.right.step_key).toBe('debit');
    }

    const exec3 = await handler.execute_next({ plan_id: 'run-6' }, storage)();
    expect(E.isRight(exec3)).toBe(true);
    if (E.isRight(exec3)) {
      expect(exec3.right.variant).toBe('all_done');
    }
  });
});
