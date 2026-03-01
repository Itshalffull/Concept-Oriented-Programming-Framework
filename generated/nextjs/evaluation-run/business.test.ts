// EvaluationRun — business.test.ts
// Business logic tests for evaluation run lifecycle with metric logging, scoring, and pass/fail.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { evaluationRunHandler } from './handler.js';
import type { EvaluationRunStorage } from './types.js';

const createTestStorage = (): EvaluationRunStorage => {
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

describe('EvaluationRun business logic', () => {
  it('full lifecycle: runEval -> logMetric -> pass with score above threshold', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-1',
      eval_name: 'accuracy-test',
      threshold: 0.80,
      metadata: { model: 'gpt-4', dataset: 'test-v2' },
    }, storage)();

    await evaluationRunHandler.logMetric({
      run_id: 'eval-1',
      metric_name: 'precision',
      value: 0.92,
      labels: { class: 'positive' },
    }, storage)();

    await evaluationRunHandler.logMetric({
      run_id: 'eval-1',
      metric_name: 'recall',
      value: 0.88,
    }, storage)();

    const passResult = await evaluationRunHandler.pass({
      run_id: 'eval-1',
      score: 0.90,
    }, storage)();

    if (E.isRight(passResult)) {
      expect(passResult.right.variant).toBe('ok');
      if (passResult.right.variant === 'ok') {
        expect(passResult.right.score).toBe(0.90);
      }
    }

    const getResult = await evaluationRunHandler.getResult({ run_id: 'eval-1' }, storage)();
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.status).toBe('passed');
      expect(getResult.right.score).toBe(0.90);
      expect(getResult.right.threshold).toBe(0.80);
      const metrics = JSON.parse(getResult.right.metrics);
      expect(metrics).toHaveLength(2);
    }
  });

  it('pass with score below threshold returns below_threshold and transitions to failed', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-2',
      eval_name: 'quality-check',
      threshold: 0.95,
    }, storage)();

    const result = await evaluationRunHandler.pass({
      run_id: 'eval-2',
      score: 0.70,
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('below_threshold');
      if (result.right.variant === 'below_threshold') {
        expect(result.right.score).toBe(0.70);
        expect(result.right.threshold).toBe(0.95);
      }
    }

    const getResult = await evaluationRunHandler.getResult({ run_id: 'eval-2' }, storage)();
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.status).toBe('failed');
    }
  });

  it('fail with explicit reason records the failure', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-3',
      eval_name: 'safety-eval',
      threshold: 0.99,
    }, storage)();

    const result = await evaluationRunHandler.fail({
      run_id: 'eval-3',
      score: 0.45,
      reason: 'Safety classifier detected harmful content in 55% of outputs',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.score).toBe(0.45);
      expect(result.right.reason).toBe('Safety classifier detected harmful content in 55% of outputs');
    }
  });

  it('logMetric on terminal state returns invalid_status', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-4',
      eval_name: 'done-eval',
      threshold: 0.5,
    }, storage)();

    await evaluationRunHandler.pass({ run_id: 'eval-4', score: 0.9 }, storage)();

    const result = await evaluationRunHandler.logMetric({
      run_id: 'eval-4',
      metric_name: 'late-metric',
      value: 1.0,
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('pass on already-passed run returns invalid_status', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-5',
      eval_name: 'double-pass',
      threshold: 0.5,
    }, storage)();

    await evaluationRunHandler.pass({ run_id: 'eval-5', score: 0.8 }, storage)();

    const result = await evaluationRunHandler.pass({ run_id: 'eval-5', score: 0.9 }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('fail on already-failed run returns invalid_status', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-6',
      eval_name: 'double-fail',
      threshold: 0.5,
    }, storage)();

    await evaluationRunHandler.fail({ run_id: 'eval-6', score: 0.2, reason: 'bad' }, storage)();

    const result = await evaluationRunHandler.fail({
      run_id: 'eval-6',
      score: 0.1,
      reason: 'worse',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('multiple metrics are accumulated correctly', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-7',
      eval_name: 'multi-metric',
      threshold: 0.5,
    }, storage)();

    for (let i = 1; i <= 5; i++) {
      const result = await evaluationRunHandler.logMetric({
        run_id: 'eval-7',
        metric_name: `metric-${i}`,
        value: i * 0.1,
      }, storage)();

      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.metric_count).toBe(i);
      }
    }
  });

  it('not_found for all operations on non-existent run', async () => {
    const storage = createTestStorage();

    const log = await evaluationRunHandler.logMetric({
      run_id: 'ghost', metric_name: 'm', value: 1,
    }, storage)();
    if (E.isRight(log)) expect(log.right.variant).toBe('notfound');

    const pass = await evaluationRunHandler.pass({ run_id: 'ghost', score: 1 }, storage)();
    if (E.isRight(pass)) expect(pass.right.variant).toBe('notfound');

    const fail = await evaluationRunHandler.fail({
      run_id: 'ghost', score: 0, reason: 'r',
    }, storage)();
    if (E.isRight(fail)) expect(fail.right.variant).toBe('notfound');

    const get = await evaluationRunHandler.getResult({ run_id: 'ghost' }, storage)();
    if (E.isRight(get)) expect(get.right.variant).toBe('notfound');
  });

  it('getResult reflects eval_name and threshold from creation', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-9',
      eval_name: 'custom-eval',
      threshold: 0.75,
    }, storage)();

    const result = await evaluationRunHandler.getResult({ run_id: 'eval-9' }, storage)();
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.eval_name).toBe('custom-eval');
      expect(result.right.threshold).toBe(0.75);
      expect(result.right.status).toBe('running');
      expect(result.right.score).toBe(0);
    }
  });

  it('pass at exact threshold succeeds', async () => {
    const storage = createTestStorage();

    await evaluationRunHandler.runEval({
      run_id: 'eval-10',
      eval_name: 'boundary',
      threshold: 0.80,
    }, storage)();

    const result = await evaluationRunHandler.pass({ run_id: 'eval-10', score: 0.80 }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }
  });
});
