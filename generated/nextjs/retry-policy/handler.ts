// RetryPolicy — Retry/backoff rules for failed steps with exponential backoff.
// Tracks attempt count and computes delay using backoff_coefficient.
// Status lifecycle: active -> exhausted | succeeded.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RetryPolicyStorage,
  RetryPolicyStatus,
  RetryPolicyCreateInput,
  RetryPolicyCreateOutput,
  RetryPolicyShouldRetryInput,
  RetryPolicyShouldRetryOutput,
  RetryPolicyRecordAttemptInput,
  RetryPolicyRecordAttemptOutput,
  RetryPolicyMarkSucceededInput,
  RetryPolicyMarkSucceededOutput,
} from './types.js';

import {
  createOk,
  shouldRetryRetry,
  shouldRetryExhausted,
  recordAttemptOk,
  recordAttemptNotFound,
  markSucceededOk,
  markSucceededNotFound,
} from './types.js';

export interface RetryPolicyError {
  readonly code: string;
  readonly message: string;
}

export interface RetryPolicyHandler {
  readonly create: (input: RetryPolicyCreateInput, storage: RetryPolicyStorage) => TE.TaskEither<RetryPolicyError, RetryPolicyCreateOutput>;
  readonly should_retry: (input: RetryPolicyShouldRetryInput, storage: RetryPolicyStorage) => TE.TaskEither<RetryPolicyError, RetryPolicyShouldRetryOutput>;
  readonly record_attempt: (input: RetryPolicyRecordAttemptInput, storage: RetryPolicyStorage) => TE.TaskEither<RetryPolicyError, RetryPolicyRecordAttemptOutput>;
  readonly mark_succeeded: (input: RetryPolicyMarkSucceededInput, storage: RetryPolicyStorage) => TE.TaskEither<RetryPolicyError, RetryPolicyMarkSucceededOutput>;
}

const storageError = (error: unknown): RetryPolicyError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/**
 * Compute the backoff delay for a given attempt using exponential backoff.
 * delay = min(initial_interval_ms * backoff_coefficient ^ (attempt - 1), max_interval_ms)
 */
const computeDelay = (
  attempt: number,
  initial_interval_ms: number,
  backoff_coefficient: number,
  max_interval_ms: number,
): number => {
  const delay = initial_interval_ms * Math.pow(backoff_coefficient, attempt - 1);
  return Math.min(Math.round(delay), max_interval_ms);
};

let policyCounter = 0;
const generatePolicyId = (): string => `policy-${Date.now()}-${++policyCounter}`;

export const retryPolicyHandler: RetryPolicyHandler = {
  /**
   * Create a retry policy for a step. Starts in active status with zero attempts.
   */
  create: (input, storage) => {
    const policy_id = generatePolicyId();
    return TE.tryCatch(
      async () => {
        const now = new Date().toISOString();
        await storage.put('retry_policies', policy_id, {
          policy_id,
          step_ref: input.step_ref,
          run_ref: input.run_ref,
          max_attempts: input.max_attempts,
          initial_interval_ms: input.initial_interval_ms,
          backoff_coefficient: input.backoff_coefficient,
          max_interval_ms: input.max_interval_ms,
          non_retryable_errors: [],
          attempt_count: 0,
          last_error: null,
          next_retry_at: null,
          status: 'active' as RetryPolicyStatus,
          created_at: now,
          updated_at: now,
        });
        return createOk(policy_id) as RetryPolicyCreateOutput;
      },
      storageError,
    );
  },

  /**
   * Determine whether the policy should retry. Checks attempt count against max_attempts.
   * If retryable, increments attempt_count and returns the computed backoff delay.
   * If exhausted, transitions to exhausted status.
   */
  should_retry: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('retry_policies', input.policy_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(
              shouldRetryExhausted(input.policy_id, '', '', input.error) as RetryPolicyShouldRetryOutput,
            ),
            (policy) => {
              const attemptCount = policy.attempt_count as number;
              const maxAttempts = policy.max_attempts as number;
              const nextAttempt = attemptCount + 1;

              // Check if max attempts reached
              if (nextAttempt > maxAttempts) {
                return TE.tryCatch(async () => {
                  await storage.put('retry_policies', input.policy_id, {
                    ...policy,
                    status: 'exhausted' as RetryPolicyStatus,
                    last_error: input.error,
                    updated_at: new Date().toISOString(),
                  });
                  return shouldRetryExhausted(
                    input.policy_id,
                    policy.step_ref as string,
                    policy.run_ref as string,
                    input.error,
                  ) as RetryPolicyShouldRetryOutput;
                }, storageError);
              }

              // Compute exponential backoff delay
              const delay_ms = computeDelay(
                nextAttempt,
                policy.initial_interval_ms as number,
                policy.backoff_coefficient as number,
                policy.max_interval_ms as number,
              );

              return TE.tryCatch(async () => {
                await storage.put('retry_policies', input.policy_id, {
                  ...policy,
                  attempt_count: nextAttempt,
                  last_error: input.error,
                  next_retry_at: new Date(Date.now() + delay_ms).toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return shouldRetryRetry(input.policy_id, delay_ms, nextAttempt) as RetryPolicyShouldRetryOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  /**
   * Record a failed attempt. Increments attempt counter and records the error.
   */
  record_attempt: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('retry_policies', input.policy_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(recordAttemptNotFound(input.policy_id) as RetryPolicyRecordAttemptOutput),
            (policy) =>
              TE.tryCatch(async () => {
                const newCount = (policy.attempt_count as number) + 1;
                await storage.put('retry_policies', input.policy_id, {
                  ...policy,
                  attempt_count: newCount,
                  last_error: input.error,
                  updated_at: new Date().toISOString(),
                });
                return recordAttemptOk(input.policy_id, newCount) as RetryPolicyRecordAttemptOutput;
              }, storageError),
          ),
        ),
      ),
    ),

  /**
   * Mark the policy as succeeded. Step eventually completed successfully.
   */
  mark_succeeded: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('retry_policies', input.policy_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(markSucceededNotFound(input.policy_id) as RetryPolicyMarkSucceededOutput),
            (policy) =>
              TE.tryCatch(async () => {
                await storage.put('retry_policies', input.policy_id, {
                  ...policy,
                  status: 'succeeded' as RetryPolicyStatus,
                  updated_at: new Date().toISOString(),
                });
                return markSucceededOk(input.policy_id) as RetryPolicyMarkSucceededOutput;
              }, storageError),
          ),
        ),
      ),
    ),
};
