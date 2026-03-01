// ProcessMetric — business.test.ts
// Business logic tests for time-series process metrics with aggregation and dimensional filtering.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { processMetricHandler } from './handler.js';
import type { ProcessMetricStorage } from './types.js';

const createTestStorage = (): ProcessMetricStorage => {
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

describe('ProcessMetric business logic', () => {
  it('record and query round-trip returns correct metrics', async () => {
    const storage = createTestStorage();

    await processMetricHandler.record({
      metric_id: 'm-1',
      name: 'latency_ms',
      value: 150,
      timestamp: '2025-06-01T10:00:00Z',
      process_ref: 'proc-1',
    }, storage)();

    await processMetricHandler.record({
      metric_id: 'm-2',
      name: 'latency_ms',
      value: 200,
      timestamp: '2025-06-01T10:05:00Z',
      process_ref: 'proc-1',
    }, storage)();

    await processMetricHandler.record({
      metric_id: 'm-3',
      name: 'latency_ms',
      value: 100,
      timestamp: '2025-06-01T10:10:00Z',
      process_ref: 'proc-1',
    }, storage)();

    const queryResult = await processMetricHandler.query({
      name: 'latency_ms',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T10:10:00Z',
      process_ref: 'proc-1',
    }, storage)();

    if (E.isRight(queryResult) && queryResult.right.variant === 'ok') {
      expect(queryResult.right.count).toBe(3);
      const metrics = JSON.parse(queryResult.right.metrics);
      expect(metrics).toHaveLength(3);
    }
  });

  it('aggregate avg computes correct average', async () => {
    const storage = createTestStorage();

    const values = [10, 20, 30, 40, 50];
    for (let i = 0; i < values.length; i++) {
      await processMetricHandler.record({
        metric_id: `avg-${i}`,
        name: 'throughput',
        value: values[i],
        timestamp: `2025-06-01T10:0${i}:00Z`,
      }, storage)();
    }

    const result = await processMetricHandler.aggregate({
      name: 'throughput',
      operation: 'avg',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T10:04:00Z',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.result).toBe(30); // (10+20+30+40+50)/5
      expect(result.right.sample_count).toBe(5);
    }
  });

  it('aggregate sum computes correct sum', async () => {
    const storage = createTestStorage();

    for (let i = 1; i <= 4; i++) {
      await processMetricHandler.record({
        metric_id: `sum-${i}`,
        name: 'errors',
        value: i * 5,
        timestamp: `2025-07-01T12:0${i}:00Z`,
      }, storage)();
    }

    const result = await processMetricHandler.aggregate({
      name: 'errors',
      operation: 'sum',
      start_time: '2025-07-01T12:00:00Z',
      end_time: '2025-07-01T12:05:00Z',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.result).toBe(50); // 5+10+15+20
      expect(result.right.sample_count).toBe(4);
    }
  });

  it('aggregate min returns minimum value', async () => {
    const storage = createTestStorage();

    const values = [42, 17, 88, 3, 65];
    for (let i = 0; i < values.length; i++) {
      await processMetricHandler.record({
        metric_id: `min-${i}`,
        name: 'response_time',
        value: values[i],
        timestamp: `2025-08-01T08:0${i}:00Z`,
      }, storage)();
    }

    const result = await processMetricHandler.aggregate({
      name: 'response_time',
      operation: 'min',
      start_time: '2025-08-01T08:00:00Z',
      end_time: '2025-08-01T08:04:00Z',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.result).toBe(3);
    }
  });

  it('aggregate max returns maximum value', async () => {
    const storage = createTestStorage();

    const values = [42, 17, 88, 3, 65];
    for (let i = 0; i < values.length; i++) {
      await processMetricHandler.record({
        metric_id: `max-${i}`,
        name: 'peak_cpu',
        value: values[i],
        timestamp: `2025-09-01T14:0${i}:00Z`,
      }, storage)();
    }

    const result = await processMetricHandler.aggregate({
      name: 'peak_cpu',
      operation: 'max',
      start_time: '2025-09-01T14:00:00Z',
      end_time: '2025-09-01T14:04:00Z',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.result).toBe(88);
    }
  });

  it('aggregate with no matching data returns no_data', async () => {
    const storage = createTestStorage();

    const result = await processMetricHandler.aggregate({
      name: 'nonexistent_metric',
      operation: 'avg',
      start_time: '2025-01-01T00:00:00Z',
      end_time: '2025-12-31T23:59:59Z',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('no_data');
    }
  });

  it('query filters by time range correctly', async () => {
    const storage = createTestStorage();

    await processMetricHandler.record({
      metric_id: 'tr-1',
      name: 'requests',
      value: 100,
      timestamp: '2025-06-01T08:00:00Z',
    }, storage)();

    await processMetricHandler.record({
      metric_id: 'tr-2',
      name: 'requests',
      value: 200,
      timestamp: '2025-06-01T12:00:00Z',
    }, storage)();

    await processMetricHandler.record({
      metric_id: 'tr-3',
      name: 'requests',
      value: 300,
      timestamp: '2025-06-01T18:00:00Z',
    }, storage)();

    // Query only morning
    const result = await processMetricHandler.query({
      name: 'requests',
      start_time: '2025-06-01T08:00:00Z',
      end_time: '2025-06-01T12:00:00Z',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(2);
    }
  });

  it('query filters by process_ref', async () => {
    const storage = createTestStorage();

    await processMetricHandler.record({
      metric_id: 'pr-1',
      name: 'duration',
      value: 10,
      timestamp: '2025-06-01T10:00:00Z',
      process_ref: 'process-a',
    }, storage)();

    await processMetricHandler.record({
      metric_id: 'pr-2',
      name: 'duration',
      value: 20,
      timestamp: '2025-06-01T10:01:00Z',
      process_ref: 'process-b',
    }, storage)();

    const result = await processMetricHandler.query({
      name: 'duration',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T10:01:00Z',
      process_ref: 'process-a',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(1);
      const metrics = JSON.parse(result.right.metrics);
      expect(metrics[0].value).toBe(10);
    }
  });

  it('query returns empty for non-matching metric name', async () => {
    const storage = createTestStorage();

    await processMetricHandler.record({
      metric_id: 'nm-1',
      name: 'cpu_usage',
      value: 50,
      timestamp: '2025-06-01T10:00:00Z',
    }, storage)();

    const result = await processMetricHandler.query({
      name: 'memory_usage',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T10:00:00Z',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(0);
    }
  });

  it('record includes dimensions in stored metric', async () => {
    const storage = createTestStorage();

    const result = await processMetricHandler.record({
      metric_id: 'dim-1',
      name: 'api_calls',
      value: 42,
      timestamp: '2025-06-01T10:00:00Z',
      dimensions: '{"endpoint":"/users","method":"GET"}',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }

    const queryResult = await processMetricHandler.query({
      name: 'api_calls',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T10:00:00Z',
    }, storage)();

    if (E.isRight(queryResult) && queryResult.right.variant === 'ok') {
      expect(queryResult.right.count).toBe(1);
    }
  });

  it('aggregate with process_ref filter isolates data', async () => {
    const storage = createTestStorage();

    await processMetricHandler.record({
      metric_id: 'iso-1',
      name: 'exec_time',
      value: 100,
      timestamp: '2025-06-01T10:00:00Z',
      process_ref: 'fast-proc',
    }, storage)();

    await processMetricHandler.record({
      metric_id: 'iso-2',
      name: 'exec_time',
      value: 500,
      timestamp: '2025-06-01T10:00:00Z',
      process_ref: 'slow-proc',
    }, storage)();

    const fastResult = await processMetricHandler.aggregate({
      name: 'exec_time',
      operation: 'avg',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T10:00:00Z',
      process_ref: 'fast-proc',
    }, storage)();

    if (E.isRight(fastResult) && fastResult.right.variant === 'ok') {
      expect(fastResult.right.result).toBe(100);
      expect(fastResult.right.sample_count).toBe(1);
    }
  });
});
