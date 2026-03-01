// RetryPolicy — business.test.ts
// Business logic tests for retry/backoff rules with exponential backoff computation.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { retryPolicyHandler } from './handler.js';
import type { RetryPolicyStorage } from './types.js';

const createTestStorage = (): RetryPolicyStorage => {
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

describe('RetryPolicy business logic', () => {
  it('exponential backoff increases delay with each retry', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'flaky-api',
      run_ref: 'run-1',
      max_attempts: 5,
      initial_interval_ms: 1000,
      backoff_coefficient: 2.0,
      max_interval_ms: 60000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    const delays: number[] = [];

    for (let i = 0; i < 3; i++) {
      const result = await retryPolicyHandler.should_retry({
        policy_id: policyId,
        error: `Attempt ${i + 1} failed`,
      }, storage)();

      if (E.isRight(result) && result.right.variant === 'retry') {
        delays.push(result.right.delay_ms);
      }
    }

    // Exponential backoff: 1000, 2000, 4000
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
  });

  it('backoff delay is capped at max_interval_ms', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'capped-api',
      run_ref: 'run-2',
      max_attempts: 10,
      initial_interval_ms: 5000,
      backoff_coefficient: 3.0,
      max_interval_ms: 30000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    // Attempt 1: 5000, Attempt 2: 15000, Attempt 3: 45000 -> capped at 30000
    await retryPolicyHandler.should_retry({ policy_id: policyId, error: 'err1' }, storage)();
    await retryPolicyHandler.should_retry({ policy_id: policyId, error: 'err2' }, storage)();

    const r3 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'err3',
    }, storage)();

    if (E.isRight(r3) && r3.right.variant === 'retry') {
      expect(r3.right.delay_ms).toBeLessThanOrEqual(30000);
    }
  });

  it('exhausts retries and transitions to exhausted status', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'limited',
      run_ref: 'run-3',
      max_attempts: 2,
      initial_interval_ms: 100,
      backoff_coefficient: 1.0,
      max_interval_ms: 1000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    // Use both attempts
    await retryPolicyHandler.should_retry({ policy_id: policyId, error: 'err1' }, storage)();
    await retryPolicyHandler.should_retry({ policy_id: policyId, error: 'err2' }, storage)();

    // Third attempt should be exhausted
    const result = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'err3',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('exhausted');
    }
  });

  it('mark_succeeded transitions policy to succeeded', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'eventual',
      run_ref: 'run-4',
      max_attempts: 5,
      initial_interval_ms: 100,
      backoff_coefficient: 1.5,
      max_interval_ms: 5000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    // Retry once then succeed
    await retryPolicyHandler.should_retry({ policy_id: policyId, error: 'err' }, storage)();

    const result = await retryPolicyHandler.mark_succeeded({ policy_id: policyId }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }
  });

  it('record_attempt increments attempt count', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'tracked',
      run_ref: 'run-5',
      max_attempts: 10,
      initial_interval_ms: 100,
      backoff_coefficient: 1.0,
      max_interval_ms: 1000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    for (let i = 1; i <= 3; i++) {
      const result = await retryPolicyHandler.record_attempt({
        policy_id: policyId,
        error: `Error attempt ${i}`,
      }, storage)();

      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.attempt_count).toBe(i);
      }
    }
  });

  it('record_attempt on non-existent policy returns not_found', async () => {
    const storage = createTestStorage();

    const result = await retryPolicyHandler.record_attempt({
      policy_id: 'ghost-policy',
      error: 'err',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('mark_succeeded on non-existent policy returns not_found', async () => {
    const storage = createTestStorage();

    const result = await retryPolicyHandler.mark_succeeded({
      policy_id: 'ghost-policy',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('should_retry tracks attempt_count accurately across calls', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'counted',
      run_ref: 'run-7',
      max_attempts: 4,
      initial_interval_ms: 500,
      backoff_coefficient: 2.0,
      max_interval_ms: 10000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    for (let i = 1; i <= 4; i++) {
      const result = await retryPolicyHandler.should_retry({
        policy_id: policyId,
        error: `err-${i}`,
      }, storage)();

      if (E.isRight(result) && result.right.variant === 'retry') {
        expect(result.right.attempt_count).toBe(i);
      }
    }

    // 5th attempt should be exhausted (max_attempts=4)
    const exhausted = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'final',
    }, storage)();

    if (E.isRight(exhausted)) {
      expect(exhausted.right.variant).toBe('exhausted');
    }
  });

  it('coefficient of 1.0 produces constant delay', async () => {
    const storage = createTestStorage();

    const createResult = await retryPolicyHandler.create({
      step_ref: 'constant',
      run_ref: 'run-8',
      max_attempts: 5,
      initial_interval_ms: 2000,
      backoff_coefficient: 1.0,
      max_interval_ms: 60000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await retryPolicyHandler.should_retry({
        policy_id: policyId,
        error: `err-${i}`,
      }, storage)();
      if (E.isRight(result) && result.right.variant === 'retry') {
        delays.push(result.right.delay_ms);
      }
    }

    // All delays should be 2000ms with coefficient 1.0
    expect(delays).toEqual([2000, 2000, 2000]);
  });
});
