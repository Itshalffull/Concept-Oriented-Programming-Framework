// RetryPolicy — conformance.test.ts
// Conformance tests for retry/backoff logic with exponential backoff and attempt tracking.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

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

describe('RetryPolicy conformance', () => {
  it('invariant: create produces an active policy', async () => {
    const storage = createTestStorage();
    const result = await retryPolicyHandler.create({
      step_ref: 'step-1',
      run_ref: 'run-1',
      max_attempts: 3,
      initial_interval_ms: 1000,
      backoff_coefficient: 2.0,
      max_interval_ms: 30000,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.policy_id).toBeDefined();
      }
    }
  });

  it('invariant: should_retry returns retry with exponential backoff delay', async () => {
    const storage = createTestStorage();
    const createResult = await retryPolicyHandler.create({
      step_ref: 'step-2',
      run_ref: 'run-2',
      max_attempts: 3,
      initial_interval_ms: 1000,
      backoff_coefficient: 2.0,
      max_interval_ms: 30000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    // First retry: delay = 1000 * 2^0 = 1000ms
    const retry1 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'connection_timeout',
    }, storage)();

    expect(E.isRight(retry1)).toBe(true);
    if (E.isRight(retry1)) {
      expect(retry1.right.variant).toBe('retry');
      if (retry1.right.variant === 'retry') {
        expect(retry1.right.attempt).toBe(1);
        expect(retry1.right.delay_ms).toBe(1000);
      }
    }

    // Second retry: delay = 1000 * 2^1 = 2000ms
    const retry2 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'connection_timeout',
    }, storage)();

    expect(E.isRight(retry2)).toBe(true);
    if (E.isRight(retry2)) {
      expect(retry2.right.variant).toBe('retry');
      if (retry2.right.variant === 'retry') {
        expect(retry2.right.attempt).toBe(2);
        expect(retry2.right.delay_ms).toBe(2000);
      }
    }

    // Third retry: delay = 1000 * 2^2 = 4000ms
    const retry3 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'connection_timeout',
    }, storage)();

    expect(E.isRight(retry3)).toBe(true);
    if (E.isRight(retry3)) {
      expect(retry3.right.variant).toBe('retry');
      if (retry3.right.variant === 'retry') {
        expect(retry3.right.attempt).toBe(3);
        expect(retry3.right.delay_ms).toBe(4000);
      }
    }

    // Fourth attempt exceeds max_attempts=3 -> exhausted
    const retry4 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'connection_timeout',
    }, storage)();

    expect(E.isRight(retry4)).toBe(true);
    if (E.isRight(retry4)) {
      expect(retry4.right.variant).toBe('exhausted');
      if (retry4.right.variant === 'exhausted') {
        expect(retry4.right.step_ref).toBe('step-2');
        expect(retry4.right.run_ref).toBe('run-2');
        expect(retry4.right.last_error).toBe('connection_timeout');
      }
    }
  });

  it('invariant: backoff delay is capped at max_interval_ms', async () => {
    const storage = createTestStorage();
    const createResult = await retryPolicyHandler.create({
      step_ref: 'step-3',
      run_ref: 'run-3',
      max_attempts: 10,
      initial_interval_ms: 1000,
      backoff_coefficient: 10.0,
      max_interval_ms: 5000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    // First retry: delay = min(1000 * 10^0, 5000) = 1000ms
    const retry1 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'timeout',
    }, storage)();

    if (E.isRight(retry1) && retry1.right.variant === 'retry') {
      expect(retry1.right.delay_ms).toBe(1000);
    }

    // Second retry: delay = min(1000 * 10^1, 5000) = 5000ms (capped)
    const retry2 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'timeout',
    }, storage)();

    if (E.isRight(retry2) && retry2.right.variant === 'retry') {
      expect(retry2.right.delay_ms).toBe(5000);
    }

    // Third retry: delay = min(1000 * 10^2, 5000) = 5000ms (capped)
    const retry3 = await retryPolicyHandler.should_retry({
      policy_id: policyId,
      error: 'timeout',
    }, storage)();

    if (E.isRight(retry3) && retry3.right.variant === 'retry') {
      expect(retry3.right.delay_ms).toBe(5000);
    }
  });

  it('invariant: record_attempt increments attempt_count', async () => {
    const storage = createTestStorage();
    const createResult = await retryPolicyHandler.create({
      step_ref: 'step-4',
      run_ref: 'run-4',
      max_attempts: 5,
      initial_interval_ms: 500,
      backoff_coefficient: 1.5,
      max_interval_ms: 10000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    const attempt1 = await retryPolicyHandler.record_attempt({
      policy_id: policyId,
      error: 'network_error',
    }, storage)();

    expect(E.isRight(attempt1)).toBe(true);
    if (E.isRight(attempt1)) {
      expect(attempt1.right.variant).toBe('ok');
      if (attempt1.right.variant === 'ok') {
        expect(attempt1.right.attempt_count).toBe(1);
      }
    }

    const attempt2 = await retryPolicyHandler.record_attempt({
      policy_id: policyId,
      error: 'network_error',
    }, storage)();

    if (E.isRight(attempt2) && attempt2.right.variant === 'ok') {
      expect(attempt2.right.attempt_count).toBe(2);
    }
  });

  it('invariant: record_attempt returns not_found for unknown policy', async () => {
    const storage = createTestStorage();
    const result = await retryPolicyHandler.record_attempt({
      policy_id: 'nonexistent',
      error: 'err',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('invariant: mark_succeeded transitions active to succeeded', async () => {
    const storage = createTestStorage();
    const createResult = await retryPolicyHandler.create({
      step_ref: 'step-5',
      run_ref: 'run-5',
      max_attempts: 3,
      initial_interval_ms: 1000,
      backoff_coefficient: 2.0,
      max_interval_ms: 30000,
    }, storage)();

    let policyId = '';
    if (E.isRight(createResult) && createResult.right.variant === 'ok') {
      policyId = createResult.right.policy_id;
    }

    // Record one attempt then succeed
    await retryPolicyHandler.should_retry({ policy_id: policyId, error: 'tmp_error' }, storage)();

    const result = await retryPolicyHandler.mark_succeeded({
      policy_id: policyId,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
    }
  });

  it('invariant: mark_succeeded returns not_found for unknown policy', async () => {
    const storage = createTestStorage();
    const result = await retryPolicyHandler.mark_succeeded({
      policy_id: 'nonexistent',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });
});
