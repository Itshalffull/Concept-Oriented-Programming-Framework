// ProcessEvent — conformance.test.ts

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { processEventHandler } from './handler.js';
import type { ProcessEventStorage } from './types.js';

const createTestStorage = (): ProcessEventStorage => {
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

describe('ProcessEvent conformance', () => {
  it('invariant: append increments sequence numbers and query returns events', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    const r1 = await pipe(
      handler.append({ run_ref: 'r1', event_type: 'step.completed', payload: '{}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.sequence_num).toBe(1);
        return output;
      }),
    )();
    expect(E.isRight(r1)).toBe(true);

    const r2 = await pipe(
      handler.append({ run_ref: 'r1', event_type: 'step.started', payload: '{}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.sequence_num).toBe(2);
        return output;
      }),
    )();
    expect(E.isRight(r2)).toBe(true);

    const r3 = await pipe(
      handler.query({ run_ref: 'r1', after_seq: 0, limit: 10 }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.count).toBe(2);
        return output;
      }),
    )();
    expect(E.isRight(r3)).toBe(true);
  });

  it('invariant: queryByType filters events by type', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    await handler.append({ run_ref: 'r2', event_type: 'step.started', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'r2', event_type: 'step.completed', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'r2', event_type: 'step.started', payload: '{}' }, storage)();

    const result = await pipe(
      handler.queryByType({ run_ref: 'r2', event_type: 'step.started', limit: 10 }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.count).toBe(2);
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: getCursor returns last sequence number', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    const cursorBefore = await pipe(
      handler.getCursor({ run_ref: 'r3' }, storage),
      TE.map((output) => {
        expect(output.last_seq).toBe(0);
        return output;
      }),
    )();
    expect(E.isRight(cursorBefore)).toBe(true);

    await handler.append({ run_ref: 'r3', event_type: 'test', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'r3', event_type: 'test', payload: '{}' }, storage)();

    const cursorAfter = await pipe(
      handler.getCursor({ run_ref: 'r3' }, storage),
      TE.map((output) => {
        expect(output.last_seq).toBe(2);
        return output;
      }),
    )();
    expect(E.isRight(cursorAfter)).toBe(true);
  });

  it('invariant: query respects after_seq and limit parameters', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    await handler.append({ run_ref: 'r4', event_type: 'a', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'r4', event_type: 'b', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'r4', event_type: 'c', payload: '{}' }, storage)();

    const result = await pipe(
      handler.query({ run_ref: 'r4', after_seq: 1, limit: 1 }, storage),
      TE.map((output) => {
        expect(output.count).toBe(1);
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });
});
