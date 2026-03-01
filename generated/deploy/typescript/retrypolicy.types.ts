// generated: retrypolicy.types.ts

export interface RetryPolicyCreateInput {
  stepRef: string;
  runRef: string;
  maxAttempts: number;
  initialIntervalMs: number;
  backoffCoefficient: number;
  maxIntervalMs: number;
}

export type RetryPolicyCreateOutput =
  { variant: "ok"; policy: string };

export interface RetryPolicyShouldRetryInput {
  policy: string;
  error: string;
}

export type RetryPolicyShouldRetryOutput =
  | { variant: "retry"; policy: string; delayMs: number; attempt: number }
  | { variant: "exhausted"; policy: string; stepRef: string; runRef: string; lastError: string };

export interface RetryPolicyRecordAttemptInput {
  policy: string;
  error: string;
}

export type RetryPolicyRecordAttemptOutput =
  { variant: "ok"; policy: string; attemptCount: number };

export interface RetryPolicyMarkSucceededInput {
  policy: string;
}

export type RetryPolicyMarkSucceededOutput =
  { variant: "ok"; policy: string };
