// ProcessRun — business.test.ts
// Business logic tests for process execution lifecycle with parent-child relationships.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import { processRunHandler } from './handler.js';
import type { ProcessRunStorage } from './types.js';

const createTestStorage = (): ProcessRunStorage => {
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

describe('ProcessRun business logic', () => {
  it('suspend-resume cycle preserves run data and input', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'cycle-1', spec_id: 'order-spec', input_data: '{"items":[1,2,3]}' }, storage)();
    await handler.suspend({ run_ref: 'cycle-1', reason: 'awaiting payment' }, storage)();

    const statusSuspended = await handler.getStatus({ run_ref: 'cycle-1' }, storage)();
    if (E.isRight(statusSuspended) && statusSuspended.right.variant === 'ok') {
      expect(statusSuspended.right.status).toBe('suspended');
      expect(statusSuspended.right.input_data).toBe('{"items":[1,2,3]}');
      expect(statusSuspended.right.spec_id).toBe('order-spec');
    }

    await handler.resume({ run_ref: 'cycle-1' }, storage)();

    const statusResumed = await handler.getStatus({ run_ref: 'cycle-1' }, storage)();
    if (E.isRight(statusResumed) && statusResumed.right.variant === 'ok') {
      expect(statusResumed.right.status).toBe('running');
      expect(statusResumed.right.input_data).toBe('{"items":[1,2,3]}');
    }
  });

  it('multiple suspend-resume cycles work correctly', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'multi-cycle', spec_id: 's1', input_data: '{}' }, storage)();

    for (let i = 0; i < 3; i++) {
      const suspendR = await handler.suspend({ run_ref: 'multi-cycle', reason: `pause-${i}` }, storage)();
      expect(E.isRight(suspendR)).toBe(true);
      if (E.isRight(suspendR)) expect(suspendR.right.variant).toBe('ok');

      const resumeR = await handler.resume({ run_ref: 'multi-cycle' }, storage)();
      expect(E.isRight(resumeR)).toBe(true);
      if (E.isRight(resumeR)) expect(resumeR.right.variant).toBe('ok');
    }

    const finalStatus = await handler.getStatus({ run_ref: 'multi-cycle' }, storage)();
    if (E.isRight(finalStatus) && finalStatus.right.variant === 'ok') {
      expect(finalStatus.right.status).toBe('running');
    }
  });

  it('child process lifecycle is independent from parent', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'parent', spec_id: 'main', input_data: '{}' }, storage)();
    await handler.startChild({ parent_run_ref: 'parent', child_run_ref: 'child-a', spec_id: 'sub', input_data: '{"sub":true}' }, storage)();

    // Complete child while parent is still running
    const childComplete = await handler.complete({ run_ref: 'child-a', output_data: '{"done":true}' }, storage)();
    expect(E.isRight(childComplete)).toBe(true);
    if (E.isRight(childComplete)) {
      expect(childComplete.right.variant).toBe('ok');
    }

    // Parent should still be running
    const parentStatus = await handler.getStatus({ run_ref: 'parent' }, storage)();
    if (E.isRight(parentStatus) && parentStatus.right.variant === 'ok') {
      expect(parentStatus.right.status).toBe('running');
    }

    // Child should show completed with parent ref
    const childStatus = await handler.getStatus({ run_ref: 'child-a' }, storage)();
    if (E.isRight(childStatus) && childStatus.right.variant === 'ok') {
      expect(childStatus.right.status).toBe('completed');
      expect(childStatus.right.parent_run_ref).toBe('parent');
    }
  });

  it('cannot start child when parent is suspended', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'susp-parent', spec_id: 'main', input_data: '{}' }, storage)();
    await handler.suspend({ run_ref: 'susp-parent', reason: 'maintenance' }, storage)();

    const result = await handler.startChild({
      parent_run_ref: 'susp-parent',
      child_run_ref: 'child-susp',
      spec_id: 'sub',
      input_data: '{}',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('parent_not_running');
    }
  });

  it('all terminal states reject all further transitions', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    // Test completed state
    await handler.start({ run_ref: 'term-comp', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.complete({ run_ref: 'term-comp', output_data: '{}' }, storage)();

    const compComplete = await handler.complete({ run_ref: 'term-comp', output_data: '{}' }, storage)();
    if (E.isRight(compComplete)) expect(compComplete.right.variant).toBe('invalid_transition');

    const compCancel = await handler.cancel({ run_ref: 'term-comp', reason: 'try' }, storage)();
    if (E.isRight(compCancel)) expect(compCancel.right.variant).toBe('invalid_transition');

    // Test failed state
    await handler.start({ run_ref: 'term-fail', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.fail({ run_ref: 'term-fail', error_code: 'ERR', error_message: 'boom' }, storage)();

    const failComplete = await handler.complete({ run_ref: 'term-fail', output_data: '{}' }, storage)();
    if (E.isRight(failComplete)) expect(failComplete.right.variant).toBe('invalid_transition');

    const failResume = await handler.resume({ run_ref: 'term-fail' }, storage)();
    if (E.isRight(failResume)) expect(failResume.right.variant).toBe('invalid_transition');

    // Test cancelled state
    await handler.start({ run_ref: 'term-cancel', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.cancel({ run_ref: 'term-cancel', reason: 'done' }, storage)();

    const cancelSuspend = await handler.suspend({ run_ref: 'term-cancel', reason: 'try' }, storage)();
    if (E.isRight(cancelSuspend)) expect(cancelSuspend.right.variant).toBe('invalid_transition');
  });

  it('not_found returned for operations on non-existent runs', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    const complete = await handler.complete({ run_ref: 'none', output_data: '{}' }, storage)();
    if (E.isRight(complete)) expect(complete.right.variant).toBe('not_found');

    const fail = await handler.fail({ run_ref: 'none', error_code: 'ERR', error_message: 'msg' }, storage)();
    if (E.isRight(fail)) expect(fail.right.variant).toBe('not_found');

    const cancel = await handler.cancel({ run_ref: 'none', reason: 'why' }, storage)();
    if (E.isRight(cancel)) expect(cancel.right.variant).toBe('not_found');

    const suspend = await handler.suspend({ run_ref: 'none', reason: 'why' }, storage)();
    if (E.isRight(suspend)) expect(suspend.right.variant).toBe('not_found');

    const resume = await handler.resume({ run_ref: 'none' }, storage)();
    if (E.isRight(resume)) expect(resume.right.variant).toBe('not_found');
  });

  it('completed run preserves output_data via getStatus', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'out-test', spec_id: 'flow', input_data: '{"x":1}' }, storage)();
    await handler.complete({ run_ref: 'out-test', output_data: '{"result":"success","count":42}' }, storage)();

    const status = await handler.getStatus({ run_ref: 'out-test' }, storage)();
    if (E.isRight(status) && status.right.variant === 'ok') {
      expect(status.right.status).toBe('completed');
      expect(status.right.output_data).toBe('{"result":"success","count":42}');
      expect(status.right.input_data).toBe('{"x":1}');
    }
  });

  it('fail from running records error details', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'err-run', spec_id: 'spec', input_data: '{}' }, storage)();
    const result = await handler.fail({
      run_ref: 'err-run',
      error_code: 'TIMEOUT',
      error_message: 'External service did not respond within 30s',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('failed');
    }
  });

  it('multiple children can be started from same parent', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'multi-parent', spec_id: 'main', input_data: '{}' }, storage)();

    for (let i = 1; i <= 5; i++) {
      const result = await handler.startChild({
        parent_run_ref: 'multi-parent',
        child_run_ref: `child-${i}`,
        spec_id: `sub-${i}`,
        input_data: `{"index":${i}}`,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.parent_run_ref).toBe('multi-parent');
          expect(result.right.child_run_ref).toBe(`child-${i}`);
        }
      }
    }
  });
});
