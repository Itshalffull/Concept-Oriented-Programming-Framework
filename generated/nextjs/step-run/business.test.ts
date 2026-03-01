// StepRun — business.test.ts
// Business logic tests for step execution lifecycle within process runs.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { stepRunHandler } from './handler.js';
import type { StepRunStorage } from './types.js';

const createTestStorage = (): StepRunStorage => {
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

describe('StepRun business logic', () => {
  it('step start, complete with output preserves data in get', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const startResult = await handler.start({
      run_ref: 'run-1',
      step_id: 'validate',
      step_name: 'Validate Order',
      input_data: '{"order_id":"ORD-123","items":["a","b"]}',
    }, storage)();

    let stepRunId = '';
    if (E.isRight(startResult) && startResult.right.variant === 'ok') {
      stepRunId = startResult.right.step_run_id;
      expect(startResult.right.status).toBe('active');
    }

    await handler.complete({
      step_run_id: stepRunId,
      output_data: '{"valid":true,"total":250.00}',
    }, storage)();

    const getResult = await handler.get({ step_run_id: stepRunId }, storage)();
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.status).toBe('completed');
      expect(getResult.right.input_data).toBe('{"order_id":"ORD-123","items":["a","b"]}');
      expect(getResult.right.output_data).toBe('{"valid":true,"total":250.00}');
      expect(getResult.right.step_name).toBe('Validate Order');
    }
  });

  it('cannot complete a step that is not active', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const startResult = await handler.start({
      run_ref: 'run-2',
      step_id: 'charge',
      step_name: 'Charge Payment',
      input_data: '{}',
    }, storage)();

    let stepRunId = '';
    if (E.isRight(startResult) && startResult.right.variant === 'ok') {
      stepRunId = startResult.right.step_run_id;
    }

    await handler.cancel({ step_run_id: stepRunId, reason: 'user cancelled' }, storage)();

    const completeResult = await handler.complete({ step_run_id: stepRunId, output_data: '{}' }, storage)();
    expect(E.isRight(completeResult)).toBe(true);
    if (E.isRight(completeResult)) {
      expect(completeResult.right.variant).toBe('invalid_transition');
    }
  });

  it('restart a failed step creates a fresh active run', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    // First run - start and fail
    const start1 = await handler.start({
      run_ref: 'run-3',
      step_id: 'flaky-step',
      step_name: 'Flaky Step',
      input_data: '{"attempt":1}',
    }, storage)();

    let stepRunId = '';
    if (E.isRight(start1) && start1.right.variant === 'ok') {
      stepRunId = start1.right.step_run_id;
    }

    await handler.fail({
      step_run_id: stepRunId,
      error_code: 'NETWORK',
      error_message: 'Connection refused',
    }, storage)();

    // Restart after failure
    const start2 = await handler.start({
      run_ref: 'run-3',
      step_id: 'flaky-step',
      step_name: 'Flaky Step',
      input_data: '{"attempt":2}',
    }, storage)();

    expect(E.isRight(start2)).toBe(true);
    if (E.isRight(start2)) {
      expect(start2.right.variant).toBe('ok');
      if (start2.right.variant === 'ok') {
        expect(start2.right.status).toBe('active');
      }
    }
  });

  it('start returns already_active for currently active step', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start({
      run_ref: 'run-4',
      step_id: 'long-running',
      step_name: 'Long Running',
      input_data: '{}',
    }, storage)();

    const result = await handler.start({
      run_ref: 'run-4',
      step_id: 'long-running',
      step_name: 'Long Running',
      input_data: '{"retry":true}',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('already_active');
    }
  });

  it('skip an active step transitions to skipped', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const startResult = await handler.start({
      run_ref: 'run-5',
      step_id: 'optional-step',
      step_name: 'Optional Step',
      input_data: '{}',
    }, storage)();

    let stepRunId = '';
    if (E.isRight(startResult) && startResult.right.variant === 'ok') {
      stepRunId = startResult.right.step_run_id;
    }

    const skipResult = await handler.skip({
      step_run_id: stepRunId,
      reason: 'Condition not met',
    }, storage)();

    expect(E.isRight(skipResult)).toBe(true);
    if (E.isRight(skipResult)) {
      expect(skipResult.right.variant).toBe('ok');
      if (skipResult.right.variant === 'ok') {
        expect(skipResult.right.status).toBe('skipped');
      }
    }
  });

  it('cannot skip a terminal state step', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const startResult = await handler.start({
      run_ref: 'run-6',
      step_id: 'done-step',
      step_name: 'Done Step',
      input_data: '{}',
    }, storage)();

    let stepRunId = '';
    if (E.isRight(startResult) && startResult.right.variant === 'ok') {
      stepRunId = startResult.right.step_run_id;
    }

    await handler.complete({ step_run_id: stepRunId, output_data: '{}' }, storage)();

    const skipResult = await handler.skip({ step_run_id: stepRunId, reason: 'too late' }, storage)();
    expect(E.isRight(skipResult)).toBe(true);
    if (E.isRight(skipResult)) {
      expect(skipResult.right.variant).toBe('invalid_transition');
    }
  });

  it('multiple steps in same run have independent lifecycles', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const s1 = await handler.start({ run_ref: 'run-7', step_id: 'step-a', step_name: 'A', input_data: '{}' }, storage)();
    const s2 = await handler.start({ run_ref: 'run-7', step_id: 'step-b', step_name: 'B', input_data: '{}' }, storage)();

    let id1 = '', id2 = '';
    if (E.isRight(s1) && s1.right.variant === 'ok') id1 = s1.right.step_run_id;
    if (E.isRight(s2) && s2.right.variant === 'ok') id2 = s2.right.step_run_id;

    await handler.complete({ step_run_id: id1, output_data: '{"done":"a"}' }, storage)();
    await handler.fail({ step_run_id: id2, error_code: 'TIMEOUT', error_message: 'B timed out' }, storage)();

    const g1 = await handler.get({ step_run_id: id1 }, storage)();
    const g2 = await handler.get({ step_run_id: id2 }, storage)();

    if (E.isRight(g1) && g1.right.variant === 'ok') expect(g1.right.status).toBe('completed');
    if (E.isRight(g2) && g2.right.variant === 'ok') expect(g2.right.status).toBe('failed');
  });

  it('not_found errors for all operations on non-existent step', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const comp = await handler.complete({ step_run_id: 'ghost', output_data: '{}' }, storage)();
    if (E.isRight(comp)) expect(comp.right.variant).toBe('not_found');

    const fail = await handler.fail({ step_run_id: 'ghost', error_code: 'E', error_message: 'm' }, storage)();
    if (E.isRight(fail)) expect(fail.right.variant).toBe('not_found');

    const canc = await handler.cancel({ step_run_id: 'ghost', reason: 'r' }, storage)();
    if (E.isRight(canc)) expect(canc.right.variant).toBe('not_found');

    const skip = await handler.skip({ step_run_id: 'ghost', reason: 'r' }, storage)();
    if (E.isRight(skip)) expect(skip.right.variant).toBe('not_found');

    const get = await handler.get({ step_run_id: 'ghost' }, storage)();
    if (E.isRight(get)) expect(get.right.variant).toBe('not_found');
  });
});
