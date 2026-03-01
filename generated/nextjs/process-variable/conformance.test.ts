// ProcessVariable — conformance.test.ts

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { processVariableHandler } from './handler.js';
import type { ProcessVariableStorage } from './types.js';

const createTestStorage = (): ProcessVariableStorage => {
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

describe('ProcessVariable conformance', () => {
  it('invariant: set creates a variable and get retrieves it', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const setResult = await pipe(
      handler.set({ run_ref: 'r1', name: 'counter', value: '42', var_type: 'integer' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.version).toBe(1);
        return output;
      }),
    )();
    expect(E.isRight(setResult)).toBe(true);

    const getResult = await pipe(
      handler.get({ run_ref: 'r1', name: 'counter' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.value).toBe('42');
          expect(output.var_type).toBe('integer');
          expect(output.version).toBe(1);
        }
        return output;
      }),
    )();
    expect(E.isRight(getResult)).toBe(true);
  });

  it('invariant: set increments version on overwrite', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'r1', name: 'x', value: '1', var_type: 'integer' }, storage)();
    const r2 = await pipe(
      handler.set({ run_ref: 'r1', name: 'x', value: '2', var_type: 'integer' }, storage),
      TE.map((output) => {
        expect(output.version).toBe(2);
        return output;
      }),
    )();
    expect(E.isRight(r2)).toBe(true);
  });

  it('invariant: get returns not_found for missing variable', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const result = await pipe(
      handler.get({ run_ref: 'r1', name: 'missing' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: merge shallow-merges JSON values', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'r1', name: 'config', value: '{"a":1,"b":2}', var_type: 'json' }, storage)();

    const mergeResult = await pipe(
      handler.merge({ run_ref: 'r1', name: 'config', partial_value: '{"b":3,"c":4}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.version).toBe(2);
        }
        return output;
      }),
    )();
    expect(E.isRight(mergeResult)).toBe(true);

    const getResult = await pipe(
      handler.get({ run_ref: 'r1', name: 'config' }, storage),
      TE.map((output) => {
        if (output.variant === 'ok') {
          const parsed = JSON.parse(output.value);
          expect(parsed).toEqual({ a: 1, b: 3, c: 4 });
        }
        return output;
      }),
    )();
    expect(E.isRight(getResult)).toBe(true);
  });

  it('invariant: merge returns not_found for missing variable', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const result = await pipe(
      handler.merge({ run_ref: 'r1', name: 'missing', partial_value: '{}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: delete removes a variable', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'r1', name: 'tmp', value: 'x', var_type: 'string' }, storage)();

    const delResult = await pipe(
      handler.delete({ run_ref: 'r1', name: 'tmp' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        return output;
      }),
    )();
    expect(E.isRight(delResult)).toBe(true);

    const getResult = await pipe(
      handler.get({ run_ref: 'r1', name: 'tmp' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(getResult)).toBe(true);
  });

  it('invariant: delete returns not_found for missing variable', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const result = await pipe(
      handler.delete({ run_ref: 'r1', name: 'missing' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: list returns all variables for a run_ref', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'r1', name: 'a', value: '1', var_type: 'integer' }, storage)();
    await handler.set({ run_ref: 'r1', name: 'b', value: '2', var_type: 'integer' }, storage)();
    await handler.set({ run_ref: 'r2', name: 'c', value: '3', var_type: 'integer' }, storage)();

    const result = await pipe(
      handler.list({ run_ref: 'r1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.count).toBe(2);
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: snapshot captures all variables at a point in time', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'r1', name: 'x', value: '10', var_type: 'integer' }, storage)();
    await handler.set({ run_ref: 'r1', name: 'y', value: '20', var_type: 'integer' }, storage)();

    const result = await pipe(
      handler.snapshot({ run_ref: 'r1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.count).toBe(2);
        expect(output.taken_at).toBeTruthy();
        const parsed = JSON.parse(output.snapshot);
        expect(parsed).toHaveLength(2);
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });
});
