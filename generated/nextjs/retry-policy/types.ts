// RetryPolicy — types.ts
// Define retry/backoff rules for failed steps and track attempt state.
// Implements exponential backoff with backoff_coefficient.
// Status lifecycle: active -> exhausted | succeeded.

export interface RetryPolicyStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

// --- Status ---

export type RetryPolicyStatus = 'active' | 'exhausted' | 'succeeded';

// --- Create ---

export interface RetryPolicyCreateInput {
  readonly step_ref: string;
  readonly run_ref: string;
  readonly max_attempts: number;
  readonly initial_interval_ms: number;
  readonly backoff_coefficient: number;
  readonly max_interval_ms: number;
}

export interface RetryPolicyCreateOutputOk {
  readonly variant: 'ok';
  readonly policy_id: string;
}

export type RetryPolicyCreateOutput = RetryPolicyCreateOutputOk;

// --- ShouldRetry ---

export interface RetryPolicyShouldRetryInput {
  readonly policy_id: string;
  readonly error: string;
}

export interface RetryPolicyShouldRetryOutputRetry {
  readonly variant: 'retry';
  readonly policy_id: string;
  readonly delay_ms: number;
  readonly attempt: number;
}

export interface RetryPolicyShouldRetryOutputExhausted {
  readonly variant: 'exhausted';
  readonly policy_id: string;
  readonly step_ref: string;
  readonly run_ref: string;
  readonly last_error: string;
}

export type RetryPolicyShouldRetryOutput =
  | RetryPolicyShouldRetryOutputRetry
  | RetryPolicyShouldRetryOutputExhausted;

// --- RecordAttempt ---

export interface RetryPolicyRecordAttemptInput {
  readonly policy_id: string;
  readonly error: string;
}

export interface RetryPolicyRecordAttemptOutputOk {
  readonly variant: 'ok';
  readonly policy_id: string;
  readonly attempt_count: number;
}

export interface RetryPolicyRecordAttemptOutputNotFound {
  readonly variant: 'not_found';
  readonly policy_id: string;
}

export type RetryPolicyRecordAttemptOutput =
  | RetryPolicyRecordAttemptOutputOk
  | RetryPolicyRecordAttemptOutputNotFound;

// --- MarkSucceeded ---

export interface RetryPolicyMarkSucceededInput {
  readonly policy_id: string;
}

export interface RetryPolicyMarkSucceededOutputOk {
  readonly variant: 'ok';
  readonly policy_id: string;
}

export interface RetryPolicyMarkSucceededOutputNotFound {
  readonly variant: 'not_found';
  readonly policy_id: string;
}

export type RetryPolicyMarkSucceededOutput =
  | RetryPolicyMarkSucceededOutputOk
  | RetryPolicyMarkSucceededOutputNotFound;

// --- Variant constructors ---

export const createOk = (policy_id: string): RetryPolicyCreateOutput =>
  ({ variant: 'ok', policy_id } as RetryPolicyCreateOutput);

export const shouldRetryRetry = (policy_id: string, delay_ms: number, attempt: number): RetryPolicyShouldRetryOutput =>
  ({ variant: 'retry', policy_id, delay_ms, attempt } as RetryPolicyShouldRetryOutput);

export const shouldRetryExhausted = (
  policy_id: string, step_ref: string, run_ref: string, last_error: string,
): RetryPolicyShouldRetryOutput =>
  ({ variant: 'exhausted', policy_id, step_ref, run_ref, last_error } as RetryPolicyShouldRetryOutput);

export const recordAttemptOk = (policy_id: string, attempt_count: number): RetryPolicyRecordAttemptOutput =>
  ({ variant: 'ok', policy_id, attempt_count } as RetryPolicyRecordAttemptOutput);

export const recordAttemptNotFound = (policy_id: string): RetryPolicyRecordAttemptOutput =>
  ({ variant: 'not_found', policy_id } as RetryPolicyRecordAttemptOutput);

export const markSucceededOk = (policy_id: string): RetryPolicyMarkSucceededOutput =>
  ({ variant: 'ok', policy_id } as RetryPolicyMarkSucceededOutput);

export const markSucceededNotFound = (policy_id: string): RetryPolicyMarkSucceededOutput =>
  ({ variant: 'not_found', policy_id } as RetryPolicyMarkSucceededOutput);
