import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { retryPolicyHandler } from "./retrypolicy.impl";

describe("RetryPolicy business logic", () => {
  it("exponential backoff delay calculation: delay doubles with coefficient 2", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-1",
        runRef: "run-1",
        maxAttempts: 10,
        initialIntervalMs: 100,
        backoffCoefficient: 2,
        maxIntervalMs: 100000,
      },
      storage,
    );
    const policy = (created as any).policy;

    // First shouldRetry: delay = 100 * 2^0 = 100
    const r1 = await retryPolicyHandler.shouldRetry(
      { policy, error: "err1" },
      storage,
    );
    expect(r1.variant).toBe("retry");
    expect((r1 as any).delayMs).toBe(100);
    expect((r1 as any).attempt).toBe(1);

    // Record attempt to increment counter
    await retryPolicyHandler.recordAttempt({ policy, error: "err1" }, storage);

    // Second shouldRetry: delay = 100 * 2^1 = 200
    const r2 = await retryPolicyHandler.shouldRetry(
      { policy, error: "err2" },
      storage,
    );
    expect(r2.variant).toBe("retry");
    expect((r2 as any).delayMs).toBe(200);
    expect((r2 as any).attempt).toBe(2);

    // Record attempt
    await retryPolicyHandler.recordAttempt({ policy, error: "err2" }, storage);

    // Third shouldRetry: delay = 100 * 2^2 = 400
    const r3 = await retryPolicyHandler.shouldRetry(
      { policy, error: "err3" },
      storage,
    );
    expect(r3.variant).toBe("retry");
    expect((r3 as any).delayMs).toBe(400);
  });

  it("maxIntervalMs caps the delay", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-2",
        runRef: "run-2",
        maxAttempts: 20,
        initialIntervalMs: 1000,
        backoffCoefficient: 10,
        maxIntervalMs: 5000,
      },
      storage,
    );
    const policy = (created as any).policy;

    // First retry: delay = 1000 * 10^0 = 1000, capped at 5000 -> 1000
    const r1 = await retryPolicyHandler.shouldRetry(
      { policy, error: "err" },
      storage,
    );
    expect((r1 as any).delayMs).toBe(1000);

    await retryPolicyHandler.recordAttempt({ policy, error: "err" }, storage);

    // Second: delay = 1000 * 10^1 = 10000, capped at 5000
    const r2 = await retryPolicyHandler.shouldRetry(
      { policy, error: "err" },
      storage,
    );
    expect((r2 as any).delayMs).toBe(5000);
  });

  it("non-retryable error immediately exhausts", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-3",
        runRef: "run-3",
        maxAttempts: 10,
        initialIntervalMs: 100,
        backoffCoefficient: 2,
        maxIntervalMs: 10000,
      },
      storage,
    );
    const policy = (created as any).policy;

    // Manually set non-retryable errors by directly updating storage
    // Since the impl checks for substring match, we need to register via storage
    const record = await storage.get("retrypolicy", policy);
    await storage.put("retrypolicy", policy, {
      ...record!,
      nonRetryableErrors: JSON.stringify(["FATAL", "AUTH_FAILED"]),
    });

    const result = await retryPolicyHandler.shouldRetry(
      { policy, error: "FATAL: disk full" },
      storage,
    );
    expect(result.variant).toBe("exhausted");
    expect((result as any).lastError).toBe("FATAL: disk full");
  });

  it("max_attempts boundary: exactly at limit returns exhausted", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-4",
        runRef: "run-4",
        maxAttempts: 2,
        initialIntervalMs: 100,
        backoffCoefficient: 1,
        maxIntervalMs: 1000,
      },
      storage,
    );
    const policy = (created as any).policy;

    // Record 2 attempts to reach the max
    await retryPolicyHandler.recordAttempt({ policy, error: "fail1" }, storage);
    await retryPolicyHandler.recordAttempt({ policy, error: "fail2" }, storage);

    // attemptCount is now 2, which equals maxAttempts
    const result = await retryPolicyHandler.shouldRetry(
      { policy, error: "fail3" },
      storage,
    );
    expect(result.variant).toBe("exhausted");
  });

  it("recordAttempt increments count", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-5",
        runRef: "run-5",
        maxAttempts: 10,
        initialIntervalMs: 100,
        backoffCoefficient: 2,
        maxIntervalMs: 10000,
      },
      storage,
    );
    const policy = (created as any).policy;

    const r1 = await retryPolicyHandler.recordAttempt(
      { policy, error: "err1" },
      storage,
    );
    expect(r1.variant).toBe("ok");
    expect((r1 as any).attemptCount).toBe(1);

    const r2 = await retryPolicyHandler.recordAttempt(
      { policy, error: "err2" },
      storage,
    );
    expect((r2 as any).attemptCount).toBe(2);

    const r3 = await retryPolicyHandler.recordAttempt(
      { policy, error: "err3" },
      storage,
    );
    expect((r3 as any).attemptCount).toBe(3);
  });

  it("markSucceeded after retries transitions to succeeded", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-6",
        runRef: "run-6",
        maxAttempts: 5,
        initialIntervalMs: 100,
        backoffCoefficient: 2,
        maxIntervalMs: 5000,
      },
      storage,
    );
    const policy = (created as any).policy;

    // Record some attempts
    await retryPolicyHandler.recordAttempt({ policy, error: "fail" }, storage);
    await retryPolicyHandler.recordAttempt({ policy, error: "fail" }, storage);

    const result = await retryPolicyHandler.markSucceeded({ policy }, storage);
    expect(result.variant).toBe("ok");
  });

  it("shouldRetry returns correct attempt number", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-7",
        runRef: "run-7",
        maxAttempts: 5,
        initialIntervalMs: 50,
        backoffCoefficient: 1.5,
        maxIntervalMs: 10000,
      },
      storage,
    );
    const policy = (created as any).policy;

    // No attempts yet, shouldRetry attempt = 1
    const r1 = await retryPolicyHandler.shouldRetry(
      { policy, error: "transient" },
      storage,
    );
    expect(r1.variant).toBe("retry");
    expect((r1 as any).attempt).toBe(1);
  });

  it("shouldRetry on nonexistent policy returns exhausted", async () => {
    const storage = createInMemoryStorage();

    const result = await retryPolicyHandler.shouldRetry(
      { policy: "rp-nonexistent", error: "some error" },
      storage,
    );
    expect(result.variant).toBe("exhausted");
  });

  it("zero max_attempts immediately exhausts on first shouldRetry", async () => {
    const storage = createInMemoryStorage();

    const created = await retryPolicyHandler.create(
      {
        stepRef: "step-8",
        runRef: "run-8",
        maxAttempts: 0,
        initialIntervalMs: 100,
        backoffCoefficient: 2,
        maxIntervalMs: 1000,
      },
      storage,
    );
    const policy = (created as any).policy;

    const result = await retryPolicyHandler.shouldRetry(
      { policy, error: "immediate fail" },
      storage,
    );
    expect(result.variant).toBe("exhausted");
  });
});
