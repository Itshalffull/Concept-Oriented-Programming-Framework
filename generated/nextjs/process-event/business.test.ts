// ProcessEvent — business.test.ts
// Business logic tests for append-only event stream with sequencing and type-based queries.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

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

describe('ProcessEvent business logic', () => {
  it('appending multiple events produces sequential sequence numbers', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await handler.append({
        run_ref: 'run-1',
        event_type: 'step_completed',
        payload: `{"step":${i}}`,
      }, storage)();
      if (E.isRight(r) && r.right.variant === 'ok') {
        results.push(r.right.sequence_num);
      }
    }

    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('query with after_seq correctly pages through events', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    for (let i = 0; i < 10; i++) {
      await handler.append({
        run_ref: 'run-2',
        event_type: i % 2 === 0 ? 'start' : 'end',
        payload: `{"i":${i}}`,
      }, storage)();
    }

    // Get events after seq 5
    const result = await handler.query({
      run_ref: 'run-2',
      after_seq: 5,
      limit: 100,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(5);
      const events = JSON.parse(result.right.events);
      expect(events[0].sequence_num).toBe(6);
      expect(events[4].sequence_num).toBe(10);
    }
  });

  it('query with limit restricts result count', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    for (let i = 0; i < 8; i++) {
      await handler.append({
        run_ref: 'run-3',
        event_type: 'tick',
        payload: `{"n":${i}}`,
      }, storage)();
    }

    const result = await handler.query({
      run_ref: 'run-3',
      after_seq: 0,
      limit: 3,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(3);
      const events = JSON.parse(result.right.events);
      expect(events).toHaveLength(3);
      expect(events[0].sequence_num).toBe(1);
      expect(events[2].sequence_num).toBe(3);
    }
  });

  it('queryByType filters events by event_type', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    await handler.append({ run_ref: 'run-4', event_type: 'step_started', payload: '{"step":"a"}' }, storage)();
    await handler.append({ run_ref: 'run-4', event_type: 'step_completed', payload: '{"step":"a"}' }, storage)();
    await handler.append({ run_ref: 'run-4', event_type: 'step_started', payload: '{"step":"b"}' }, storage)();
    await handler.append({ run_ref: 'run-4', event_type: 'error_occurred', payload: '{"step":"b"}' }, storage)();
    await handler.append({ run_ref: 'run-4', event_type: 'step_started', payload: '{"step":"c"}' }, storage)();

    const result = await handler.queryByType({
      run_ref: 'run-4',
      event_type: 'step_started',
      limit: 100,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(3);
      const events = JSON.parse(result.right.events);
      expect(events.every((e: Record<string, unknown>) => e.event_type === 'step_started')).toBe(true);
    }
  });

  it('getCursor returns latest sequence number', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    const cursor0 = await handler.getCursor({ run_ref: 'run-5' }, storage)();
    if (E.isRight(cursor0)) {
      expect(cursor0.right.cursor).toBe(0);
    }

    await handler.append({ run_ref: 'run-5', event_type: 'e1', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'run-5', event_type: 'e2', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'run-5', event_type: 'e3', payload: '{}' }, storage)();

    const cursor3 = await handler.getCursor({ run_ref: 'run-5' }, storage)();
    if (E.isRight(cursor3)) {
      expect(cursor3.right.cursor).toBe(3);
    }
  });

  it('events from different runs are isolated', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    await handler.append({ run_ref: 'iso-a', event_type: 'start', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'iso-a', event_type: 'end', payload: '{}' }, storage)();
    await handler.append({ run_ref: 'iso-b', event_type: 'start', payload: '{}' }, storage)();

    const qA = await handler.query({ run_ref: 'iso-a', after_seq: 0, limit: 100 }, storage)();
    const qB = await handler.query({ run_ref: 'iso-b', after_seq: 0, limit: 100 }, storage)();

    if (E.isRight(qA) && qA.right.variant === 'ok') expect(qA.right.count).toBe(2);
    if (E.isRight(qB) && qB.right.variant === 'ok') expect(qB.right.count).toBe(1);
  });

  it('query returns empty list for run with no events', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    const result = await handler.query({ run_ref: 'empty', after_seq: 0, limit: 100 }, storage)();
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(0);
    }
  });

  it('queryByType with limit restricts results', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    for (let i = 0; i < 6; i++) {
      await handler.append({ run_ref: 'run-7', event_type: 'same_type', payload: `{"n":${i}}` }, storage)();
    }

    const result = await handler.queryByType({
      run_ref: 'run-7',
      event_type: 'same_type',
      limit: 2,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(2);
    }
  });

  it('queryByType returns empty for non-matching type', async () => {
    const storage = createTestStorage();
    const handler = processEventHandler;

    await handler.append({ run_ref: 'run-8', event_type: 'exists', payload: '{}' }, storage)();

    const result = await handler.queryByType({
      run_ref: 'run-8',
      event_type: 'nonexistent_type',
      limit: 100,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(0);
    }
  });
});
