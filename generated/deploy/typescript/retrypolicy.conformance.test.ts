// generated: retrypolicy.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { retryPolicyHandler } from "./retrypolicy.impl";

describe("RetryPolicy conformance", () => {

  it("create then shouldRetry returns retry with exponential backoff delay", async () => {
    const storage = createInMemoryStorage();

    const step1 = await retryPolicyHandler.create(
      { stepRef: "step-1", runRef: "run-1", maxAttempts: 3, initialIntervalMs: 1000, backoffCoefficient: 2.0, maxIntervalMs: 30000 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const policy = (step1 as any).policy;

    // First shouldRetry: delay = 1000 * 2^0 = 1000
    const step2 = await retryPolicyHandler.shouldRetry(
      { policy, error: "timeout" },
      storage,
    );
    expect(step2.variant).toBe("retry");
    expect((step2 as any).delayMs).toBe(1000);
    expect((step2 as any).attempt).toBe(1);
  });

  it("shouldRetry returns exhausted after max attempts reached", async () => {
    const storage = createInMemoryStorage();

    const step1 = await retryPolicyHandler.create(
      { stepRef: "step-2", runRef: "run-2", maxAttempts: 2, initialIntervalMs: 500, backoffCoefficient: 1.5, maxIntervalMs: 10000 },
      storage,
    );
    const policy = (step1 as any).policy;

    // Record 2 attempts to reach max
    await retryPolicyHandler.recordAttempt({ policy, error: "err1" }, storage);
    await retryPolicyHandler.recordAttempt({ policy, error: "err2" }, storage);

    // Now shouldRetry should return exhausted
    const step2 = await retryPolicyHandler.shouldRetry(
      { policy, error: "err3" },
      storage,
    );
    expect(step2.variant).toBe("exhausted");
    expect((step2 as any).stepRef).toBe("step-2");
    expect((step2 as any).runRef).toBe("run-2");
    expect((step2 as any).lastError).toBe("err3");
  });

  it("recordAttempt increments attempt count", async () => {
    const storage = createInMemoryStorage();

    const step1 = await retryPolicyHandler.create(
      { stepRef: "step-3", runRef: "run-3", maxAttempts: 5, initialIntervalMs: 100, backoffCoefficient: 2.0, maxIntervalMs: 5000 },
      storage,
    );
    const policy = (step1 as any).policy;

    const step2 = await retryPolicyHandler.recordAttempt(
      { policy, error: "connection reset" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).attemptCount).toBe(1);

    const step3 = await retryPolicyHandler.recordAttempt(
      { policy, error: "connection reset again" },
      storage,
    );
    expect((step3 as any).attemptCount).toBe(2);
  });

  it("markSucceeded transitions to succeeded", async () => {
    const storage = createInMemoryStorage();

    const step1 = await retryPolicyHandler.create(
      { stepRef: "step-4", runRef: "run-4", maxAttempts: 3, initialIntervalMs: 1000, backoffCoefficient: 2.0, maxIntervalMs: 30000 },
      storage,
    );
    const policy = (step1 as any).policy;

    const step2 = await retryPolicyHandler.markSucceeded(
      { policy },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).policy).toBe(policy);
  });

  it("backoff delay respects maxIntervalMs ceiling", async () => {
    const storage = createInMemoryStorage();

    const step1 = await retryPolicyHandler.create(
      { stepRef: "step-5", runRef: "run-5", maxAttempts: 10, initialIntervalMs: 1000, backoffCoefficient: 10.0, maxIntervalMs: 5000 },
      storage,
    );
    const policy = (step1 as any).policy;

    // Record a few attempts so backoff would exceed max
    await retryPolicyHandler.recordAttempt({ policy, error: "e" }, storage);
    await retryPolicyHandler.recordAttempt({ policy, error: "e" }, storage);
    await retryPolicyHandler.recordAttempt({ policy, error: "e" }, storage);

    // 1000 * 10^3 = 1000000 but capped at 5000
    const step2 = await retryPolicyHandler.shouldRetry(
      { policy, error: "e" },
      storage,
    );
    expect(step2.variant).toBe("retry");
    expect((step2 as any).delayMs).toBe(5000);
  });

});
