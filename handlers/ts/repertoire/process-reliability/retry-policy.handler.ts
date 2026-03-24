// @clef-handler style=functional
// ============================================================
// RetryPolicy Concept Implementation
//
// Define retry/backoff rules for failed steps and track
// attempt state. Supports configurable max attempts, exponential
// backoff, and non-retryable error lists.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const _retryPolicyHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const runRef = input.run_ref as string;
    const maxAttempts = input.max_attempts as number;
    const initialIntervalMs = input.initial_interval_ms as number;
    const backoffCoefficient = input.backoff_coefficient as number;
    const maxIntervalMs = input.max_interval_ms as number;
    const nonRetryableErrors = (input.non_retryable_errors || []) as string[];

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }

    const policyId = randomUUID();

    let p = createProgram();
    p = put(p, 'policies', policyId, {
      id: policyId,
      step_ref: stepRef,
      run_ref: runRef,
      config: {
        max_attempts: maxAttempts,
        initial_interval_ms: initialIntervalMs,
        backoff_coefficient: backoffCoefficient,
        max_interval_ms: maxIntervalMs,
        non_retryable_errors: nonRetryableErrors,
      },
      attempt_count: 0,
      last_error: null,
      next_retry_at: null,
      status: 'active',
    });

    return complete(p, 'ok', { policy: policyId }) as StorageProgram<Result>;
  },

  should_retry(input: Record<string, unknown>) {
    const policyId = input.policy as string;
    const error = input.error as string;

    if (!error || error.trim() === '') {
      return complete(createProgram(), 'error', { message: 'error is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'policies', policyId, 'existing');

    p = branch(p, 'existing',
      (b) => {
        // Check non-retryable errors and attempt count
        return mapBindings(b, (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          const config = policy.config as Record<string, unknown>;
          const nonRetryable = (config.non_retryable_errors || []) as string[];
          const maxAttempts = config.max_attempts as number;
          const attemptCount = policy.attempt_count as number;

          if (nonRetryable.includes(error)) return 'exhausted';
          if (attemptCount + 1 >= maxAttempts) return 'exhausted';
          return 'retry';
        }, '_decision');
      },
      (b) => complete(b, 'error', { message: 'Policy not found' }),
    );

    p = branch(p,
      (bindings) => (bindings._decision as string) === 'retry',
      // Can retry — compute backoff delay
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          const config = policy.config as Record<string, unknown>;
          const attemptCount = policy.attempt_count as number;
          const initialMs = config.initial_interval_ms as number;
          const coefficient = config.backoff_coefficient as number;
          const maxMs = config.max_interval_ms as number;

          const delay = Math.min(
            initialMs * Math.pow(coefficient, attemptCount),
            maxMs,
          );
          return Math.round(delay);
        }, '_delayMs');

        b2 = mapBindings(b2, (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          return (policy.attempt_count as number) + 1;
        }, '_nextAttempt');

        // Update policy state
        b2 = putFrom(b2, 'policies', policyId, (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          const nextAttempt = bindings._nextAttempt as number;
          const delayMs = bindings._delayMs as number;
          const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
          return {
            ...policy,
            attempt_count: nextAttempt,
            last_error: error,
            next_retry_at: nextRetryAt,
          };
        });

        return completeFrom(b2, 'retry', (bindings) => ({
          policy: policyId,
          delay_ms: bindings._delayMs as number,
          attempt: bindings._nextAttempt as number,
        }));
      },
      // Exhausted — mark as exhausted
      (b) => {
        return branch(b, 'existing',
          (b2) => {
            let b3 = putFrom(b2, 'policies', policyId, (bindings) => {
              const policy = bindings.existing as Record<string, unknown>;
              return {
                ...policy,
                status: 'exhausted',
                last_error: error,
              };
            });
            return completeFrom(b3, 'ok', (bindings) => {
              const policy = bindings.existing as Record<string, unknown>;
              return {
                policy: policyId,
                step_ref: policy.step_ref as string,
                run_ref: policy.run_ref as string,
                last_error: error,
              };
            });
          },
          (b2) => complete(b2, 'error', { message: 'Policy not found' }),
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  record_attempt(input: Record<string, unknown>) {
    const policyId = input.policy as string;
    const error = input.error as string;

    if (!error || error.trim() === '') {
      return complete(createProgram(), 'error', { message: 'error is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'policies', policyId, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'policies', policyId, (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          const newCount = (policy.attempt_count as number) + 1;
          return {
            ...policy,
            attempt_count: newCount,
            last_error: error,
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          return {
            policy: policyId,
            attempt_count: (policy.attempt_count as number) + 1,
          };
        });
      },
      (b) => complete(b, 'error', { message: 'Policy not found' }),
    );

    return p as StorageProgram<Result>;
  },

  mark_succeeded(input: Record<string, unknown>) {
    const policyId = input.policy as string;

    let p = createProgram();
    p = get(p, 'policies', policyId, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'policies', policyId, (bindings) => {
          const policy = bindings.existing as Record<string, unknown>;
          return {
            ...policy,
            status: 'succeeded',
            next_retry_at: null,
          };
        });
        return complete(b2, 'ok', { policy: policyId });
      },
      (b) => complete(b, 'error', { message: 'Policy not found' }),
    );

    return p as StorageProgram<Result>;
  },
};

export const retryPolicyHandler = autoInterpret(_retryPolicyHandler);
