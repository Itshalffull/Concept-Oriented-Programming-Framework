// ProcessRun — conformance.test.ts

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

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

describe('ProcessRun conformance', () => {
  it('invariant: start creates a running process and getStatus retrieves it', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    const startResult = await pipe(
      handler.start({ run_ref: 'run1', spec_id: 'spec1', input_data: '{"order_id":123}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('running');
        }
        return output;
      }),
    )();
    expect(E.isRight(startResult)).toBe(true);

    const statusResult = await pipe(
      handler.getStatus({ run_ref: 'run1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('running');
          expect(output.spec_id).toBe('spec1');
          expect(output.parent_run_ref).toBeNull();
        }
        return output;
      }),
    )();
    expect(E.isRight(statusResult)).toBe(true);
  });

  it('invariant: start returns already_exists for duplicate run_ref', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'run1', spec_id: 'spec1', input_data: '{}' }, storage)();

    const result = await pipe(
      handler.start({ run_ref: 'run1', spec_id: 'spec2', input_data: '{}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('already_exists');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: startChild creates a child process linked to parent', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'parent1', spec_id: 'spec1', input_data: '{}' }, storage)();

    const result = await pipe(
      handler.startChild(
        { parent_run_ref: 'parent1', child_run_ref: 'child1', spec_id: 'sub_spec', input_data: '{}' },
        storage,
      ),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.parent_run_ref).toBe('parent1');
          expect(output.child_run_ref).toBe('child1');
          expect(output.status).toBe('running');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);

    // Verify child has parent reference
    const childStatus = await pipe(
      handler.getStatus({ run_ref: 'child1' }, storage),
      TE.map((output) => {
        if (output.variant === 'ok') {
          expect(output.parent_run_ref).toBe('parent1');
        }
        return output;
      }),
    )();
    expect(E.isRight(childStatus)).toBe(true);
  });

  it('invariant: startChild rejects when parent is not running', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    // Parent not found
    const notFoundResult = await pipe(
      handler.startChild(
        { parent_run_ref: 'missing', child_run_ref: 'c1', spec_id: 's1', input_data: '{}' },
        storage,
      ),
      TE.map((output) => {
        expect(output.variant).toBe('parent_not_found');
        return output;
      }),
    )();
    expect(E.isRight(notFoundResult)).toBe(true);

    // Parent completed
    await handler.start({ run_ref: 'p2', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.complete({ run_ref: 'p2', output_data: '{}' }, storage)();

    const notRunningResult = await pipe(
      handler.startChild(
        { parent_run_ref: 'p2', child_run_ref: 'c2', spec_id: 's1', input_data: '{}' },
        storage,
      ),
      TE.map((output) => {
        expect(output.variant).toBe('parent_not_running');
        return output;
      }),
    )();
    expect(E.isRight(notRunningResult)).toBe(true);
  });

  it('invariant: lifecycle running -> completed', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r1', spec_id: 's1', input_data: '{}' }, storage)();

    const result = await pipe(
      handler.complete({ run_ref: 'r1', output_data: '{"result":"success"}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('completed');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: lifecycle running -> failed', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r2', spec_id: 's1', input_data: '{}' }, storage)();

    const result = await pipe(
      handler.fail({ run_ref: 'r2', error_code: 'TIMEOUT', error_message: 'Process timed out' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('failed');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: lifecycle running -> cancelled', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r3', spec_id: 's1', input_data: '{}' }, storage)();

    const result = await pipe(
      handler.cancel({ run_ref: 'r3', reason: 'user cancelled' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('cancelled');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: lifecycle running <-> suspended', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r4', spec_id: 's1', input_data: '{}' }, storage)();

    // Suspend: running -> suspended
    const suspendResult = await pipe(
      handler.suspend({ run_ref: 'r4', reason: 'waiting for external input' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('suspended');
        }
        return output;
      }),
    )();
    expect(E.isRight(suspendResult)).toBe(true);

    // Resume: suspended -> running
    const resumeResult = await pipe(
      handler.resume({ run_ref: 'r4' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('running');
        }
        return output;
      }),
    )();
    expect(E.isRight(resumeResult)).toBe(true);
  });

  it('invariant: suspend rejects non-running processes', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r5', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.complete({ run_ref: 'r5', output_data: '{}' }, storage)();

    const result = await pipe(
      handler.suspend({ run_ref: 'r5', reason: 'too late' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        if (output.variant === 'invalid_transition') {
          expect(output.current_status).toBe('completed');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: resume rejects non-suspended processes', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r6', spec_id: 's1', input_data: '{}' }, storage)();

    const result = await pipe(
      handler.resume({ run_ref: 'r6' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        if (output.variant === 'invalid_transition') {
          expect(output.current_status).toBe('running');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: cancel works from suspended state', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r7', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.suspend({ run_ref: 'r7', reason: 'paused' }, storage)();

    const result = await pipe(
      handler.cancel({ run_ref: 'r7', reason: 'no longer needed' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('cancelled');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: terminal states reject further transitions', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    await handler.start({ run_ref: 'r8', spec_id: 's1', input_data: '{}' }, storage)();
    await handler.complete({ run_ref: 'r8', output_data: '{}' }, storage)();

    // Cannot fail a completed run
    const failResult = await pipe(
      handler.fail({ run_ref: 'r8', error_code: 'ERR', error_message: 'too late' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        return output;
      }),
    )();
    expect(E.isRight(failResult)).toBe(true);

    // Cannot suspend a completed run
    const suspendResult = await pipe(
      handler.suspend({ run_ref: 'r8', reason: 'too late' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        return output;
      }),
    )();
    expect(E.isRight(suspendResult)).toBe(true);
  });

  it('invariant: getStatus returns not_found for unknown run_ref', async () => {
    const storage = createTestStorage();
    const handler = processRunHandler;

    const result = await pipe(
      handler.getStatus({ run_ref: 'nonexistent' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });
});
