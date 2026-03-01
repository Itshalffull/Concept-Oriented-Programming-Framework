// RetryPolicy Concept Implementation
// Define retry/backoff rules for failed steps and track attempt state.
// Implements exponential backoff with configurable coefficient and max interval.
import type { ConceptStorage } from "@clef/runtime";
import type { RetryPolicyHandler } from "./retrypolicy.handler";

const RELATION = "retrypolicy";

let policyCounter = 0;
function nextPolicyId(): string {
  policyCounter += 1;
  return `rp-${Date.now()}-${String(policyCounter).padStart(4, "0")}`;
}

export const retryPolicyHandler: RetryPolicyHandler = {
  async create(input, storage) {
    const { stepRef, runRef, maxAttempts, initialIntervalMs, backoffCoefficient, maxIntervalMs } = input;

    const policyId = nextPolicyId();

    await storage.put(RELATION, policyId, {
      policy: policyId,
      stepRef,
      runRef,
      maxAttempts,
      initialIntervalMs,
      backoffCoefficient,
      maxIntervalMs,
      nonRetryableErrors: JSON.stringify([]),
      attemptCount: 0,
      lastError: "",
      nextRetryAt: "",
      status: "active",
    });

    return { variant: "ok", policy: policyId };
  },

  async shouldRetry(input, storage) {
    const { policy, error } = input;

    const record = await storage.get(RELATION, policy);
    if (!record) {
      return {
        variant: "exhausted",
        policy,
        stepRef: "",
        runRef: "",
        lastError: error,
      };
    }

    const attemptCount = (record.attemptCount as number) || 0;
    const maxAttempts = record.maxAttempts as number;
    const initialIntervalMs = record.initialIntervalMs as number;
    const backoffCoefficient = record.backoffCoefficient as number;
    const maxIntervalMs = record.maxIntervalMs as number;

    // Check non-retryable errors
    const nonRetryable: string[] = JSON.parse((record.nonRetryableErrors as string) || "[]");
    if (nonRetryable.some((e) => error.includes(e))) {
      await storage.put(RELATION, policy, {
        ...record,
        status: "exhausted",
        lastError: error,
      });
      return {
        variant: "exhausted",
        policy,
        stepRef: record.stepRef as string,
        runRef: record.runRef as string,
        lastError: error,
      };
    }

    // Check if attempts are exhausted
    if (attemptCount >= maxAttempts) {
      await storage.put(RELATION, policy, {
        ...record,
        status: "exhausted",
        lastError: error,
      });
      return {
        variant: "exhausted",
        policy,
        stepRef: record.stepRef as string,
        runRef: record.runRef as string,
        lastError: error,
      };
    }

    // Compute exponential backoff delay
    const delayMs = Math.min(
      initialIntervalMs * Math.pow(backoffCoefficient, attemptCount),
      maxIntervalMs,
    );

    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    await storage.put(RELATION, policy, {
      ...record,
      lastError: error,
      nextRetryAt,
    });

    return {
      variant: "retry",
      policy,
      delayMs: Math.round(delayMs),
      attempt: attemptCount + 1,
    };
  },

  async recordAttempt(input, storage) {
    const { policy, error } = input;

    const record = await storage.get(RELATION, policy);
    const currentCount = record ? (record.attemptCount as number) || 0 : 0;
    const newCount = currentCount + 1;

    if (record) {
      await storage.put(RELATION, policy, {
        ...record,
        attemptCount: newCount,
        lastError: error,
      });
    }

    return { variant: "ok", policy, attemptCount: newCount };
  },

  async markSucceeded(input, storage) {
    const { policy } = input;

    const record = await storage.get(RELATION, policy);
    if (record) {
      await storage.put(RELATION, policy, {
        ...record,
        status: "succeeded",
      });
    }

    return { variant: "ok", policy };
  },
};
