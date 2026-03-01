// StepRun — conformance.test.ts

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

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

describe('StepRun conformance', () => {
  it('invariant: start creates an active step run', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const result = await pipe(
      handler.start(
        { run_ref: 'r1', step_id: 'step1', step_name: 'Validate Input', input_data: '{}' },
        storage,
      ),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('active');
          expect(output.step_run_id).toBe('r1::step1');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: start returns already_active for a running step', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start(
      { run_ref: 'r1', step_id: 's1', step_name: 'A', input_data: '{}' },
      storage,
    )();

    const result = await pipe(
      handler.start(
        { run_ref: 'r1', step_id: 's1', step_name: 'A', input_data: '{}' },
        storage,
      ),
      TE.map((output) => {
        expect(output.variant).toBe('already_active');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: complete transitions active -> completed', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start(
      { run_ref: 'r1', step_id: 's1', step_name: 'Process', input_data: '{"x":1}' },
      storage,
    )();

    const result = await pipe(
      handler.complete({ step_run_id: 'r1::s1', output_data: '{"result":"done"}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('completed');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);

    // Verify via get
    const getResult = await pipe(
      handler.get({ step_run_id: 'r1::s1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('completed');
          expect(output.output_data).toBe('{"result":"done"}');
        }
        return output;
      }),
    )();
    expect(E.isRight(getResult)).toBe(true);
  });

  it('invariant: complete rejects non-active step', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const result = await pipe(
      handler.complete({ step_run_id: 'nonexistent', output_data: '{}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: fail transitions active -> failed', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start(
      { run_ref: 'r1', step_id: 's2', step_name: 'Risky', input_data: '{}' },
      storage,
    )();

    const result = await pipe(
      handler.fail({ step_run_id: 'r1::s2', error_code: 'TIMEOUT', error_message: 'Step timed out' }, storage),
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

  it('invariant: cancel transitions active -> cancelled', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start(
      { run_ref: 'r1', step_id: 's3', step_name: 'Long Step', input_data: '{}' },
      storage,
    )();

    const result = await pipe(
      handler.cancel({ step_run_id: 'r1::s3', reason: 'user requested' }, storage),
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

  it('invariant: skip transitions active -> skipped', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start(
      { run_ref: 'r1', step_id: 's4', step_name: 'Optional Step', input_data: '{}' },
      storage,
    )();

    const result = await pipe(
      handler.skip({ step_run_id: 'r1::s4', reason: 'not applicable' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('skipped');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: terminal states reject further transitions', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    await handler.start(
      { run_ref: 'r1', step_id: 's5', step_name: 'Done Step', input_data: '{}' },
      storage,
    )();
    await handler.complete({ step_run_id: 'r1::s5', output_data: '{}' }, storage)();

    // Cannot fail a completed step
    const failResult = await pipe(
      handler.fail({ step_run_id: 'r1::s5', error_code: 'ERR', error_message: 'too late' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        if (output.variant === 'invalid_transition') {
          expect(output.current_status).toBe('completed');
        }
        return output;
      }),
    )();
    expect(E.isRight(failResult)).toBe(true);

    // Cannot cancel a completed step
    const cancelResult = await pipe(
      handler.cancel({ step_run_id: 'r1::s5', reason: 'too late' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        return output;
      }),
    )();
    expect(E.isRight(cancelResult)).toBe(true);
  });

  it('invariant: get returns not_found for unknown step_run_id', async () => {
    const storage = createTestStorage();
    const handler = stepRunHandler;

    const result = await pipe(
      handler.get({ step_run_id: 'nonexistent' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });
});
