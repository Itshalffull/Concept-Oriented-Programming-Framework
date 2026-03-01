// ProcessVariable — business.test.ts
// Business logic tests for scoped key-value store with versioning, merge, and snapshots.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

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

describe('ProcessVariable business logic', () => {
  it('set and get round-trip preserves value and type', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({
      run_ref: 'run-1',
      name: 'order_total',
      value: '{"amount":99.95,"currency":"USD"}',
      var_type: 'json',
    }, storage)();

    const getResult = await handler.get({ run_ref: 'run-1', name: 'order_total' }, storage)();
    expect(E.isRight(getResult)).toBe(true);
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.value).toBe('{"amount":99.95,"currency":"USD"}');
      expect(getResult.right.var_type).toBe('json');
      expect(getResult.right.version).toBe(1);
    }
  });

  it('multiple sets to same variable increment version', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const s1 = await handler.set({ run_ref: 'run-2', name: 'counter', value: '1', var_type: 'number' }, storage)();
    if (E.isRight(s1) && s1.right.variant === 'ok') expect(s1.right.version).toBe(1);

    const s2 = await handler.set({ run_ref: 'run-2', name: 'counter', value: '2', var_type: 'number' }, storage)();
    if (E.isRight(s2) && s2.right.variant === 'ok') expect(s2.right.version).toBe(2);

    const s3 = await handler.set({ run_ref: 'run-2', name: 'counter', value: '3', var_type: 'number' }, storage)();
    if (E.isRight(s3) && s3.right.variant === 'ok') expect(s3.right.version).toBe(3);
  });

  it('merge combines partial values with existing JSON', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({
      run_ref: 'run-3',
      name: 'config',
      value: '{"debug":false,"timeout":30,"retries":3}',
      var_type: 'json',
    }, storage)();

    const mergeResult = await handler.merge({
      run_ref: 'run-3',
      name: 'config',
      partial_value: '{"debug":true,"max_connections":10}',
    }, storage)();

    expect(E.isRight(mergeResult)).toBe(true);
    if (E.isRight(mergeResult) && mergeResult.right.variant === 'ok') {
      expect(mergeResult.right.version).toBe(2);
    }

    const getResult = await handler.get({ run_ref: 'run-3', name: 'config' }, storage)();
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      const parsed = JSON.parse(getResult.right.value);
      expect(parsed.debug).toBe(true);
      expect(parsed.timeout).toBe(30);
      expect(parsed.retries).toBe(3);
      expect(parsed.max_connections).toBe(10);
    }
  });

  it('merge on non-existent variable returns not_found', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const result = await handler.merge({
      run_ref: 'run-4',
      name: 'nonexistent',
      partial_value: '{"x":1}',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('delete removes variable and subsequent get returns not_found', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'run-5', name: 'temp', value: '"hello"', var_type: 'string' }, storage)();

    const delResult = await handler.delete({ run_ref: 'run-5', name: 'temp' }, storage)();
    expect(E.isRight(delResult)).toBe(true);
    if (E.isRight(delResult)) expect(delResult.right.variant).toBe('ok');

    const getResult = await handler.get({ run_ref: 'run-5', name: 'temp' }, storage)();
    if (E.isRight(getResult)) expect(getResult.right.variant).toBe('not_found');
  });

  it('delete non-existent variable returns not_found', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const result = await handler.delete({ run_ref: 'run-6', name: 'ghost' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) expect(result.right.variant).toBe('not_found');
  });

  it('list returns all variables for a run with correct count', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'run-7', name: 'x', value: '1', var_type: 'number' }, storage)();
    await handler.set({ run_ref: 'run-7', name: 'y', value: '2', var_type: 'number' }, storage)();
    await handler.set({ run_ref: 'run-7', name: 'z', value: '3', var_type: 'number' }, storage)();

    const listResult = await handler.list({ run_ref: 'run-7' }, storage)();
    expect(E.isRight(listResult)).toBe(true);
    if (E.isRight(listResult) && listResult.right.variant === 'ok') {
      expect(listResult.right.count).toBe(3);
      const vars = JSON.parse(listResult.right.variables);
      const names = vars.map((v: { name: string }) => v.name);
      expect(names).toContain('x');
      expect(names).toContain('y');
      expect(names).toContain('z');
    }
  });

  it('snapshot captures all variables at a point in time', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'run-8', name: 'state', value: '"processing"', var_type: 'string' }, storage)();
    await handler.set({ run_ref: 'run-8', name: 'progress', value: '0.5', var_type: 'number' }, storage)();

    const snapResult = await handler.snapshot({ run_ref: 'run-8' }, storage)();
    expect(E.isRight(snapResult)).toBe(true);
    if (E.isRight(snapResult) && snapResult.right.variant === 'ok') {
      expect(snapResult.right.count).toBe(2);
      expect(snapResult.right.taken_at).toBeTruthy();
      const snap = JSON.parse(snapResult.right.snapshot);
      expect(snap).toHaveLength(2);
    }
  });

  it('variables are isolated between different runs', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'run-a', name: 'shared-name', value: '"value-a"', var_type: 'string' }, storage)();
    await handler.set({ run_ref: 'run-b', name: 'shared-name', value: '"value-b"', var_type: 'string' }, storage)();

    const getA = await handler.get({ run_ref: 'run-a', name: 'shared-name' }, storage)();
    const getB = await handler.get({ run_ref: 'run-b', name: 'shared-name' }, storage)();

    if (E.isRight(getA) && getA.right.variant === 'ok') expect(getA.right.value).toBe('"value-a"');
    if (E.isRight(getB) && getB.right.variant === 'ok') expect(getB.right.value).toBe('"value-b"');
  });

  it('list returns empty for run with no variables', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    const result = await handler.list({ run_ref: 'empty-run' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(0);
    }
  });

  it('successive merges accumulate fields correctly', async () => {
    const storage = createTestStorage();
    const handler = processVariableHandler;

    await handler.set({ run_ref: 'run-10', name: 'obj', value: '{"a":1}', var_type: 'json' }, storage)();
    await handler.merge({ run_ref: 'run-10', name: 'obj', partial_value: '{"b":2}' }, storage)();
    await handler.merge({ run_ref: 'run-10', name: 'obj', partial_value: '{"c":3}' }, storage)();

    const getResult = await handler.get({ run_ref: 'run-10', name: 'obj' }, storage)();
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      const parsed = JSON.parse(getResult.right.value);
      expect(parsed).toEqual({ a: 1, b: 2, c: 3 });
      expect(getResult.right.version).toBe(3);
    }
  });
});
