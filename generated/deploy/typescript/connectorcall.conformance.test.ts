// generated: connectorcall.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { connectorCallHandler } from "./connectorcall.impl";

describe("ConnectorCall conformance", () => {

  it("invoke creates a call in invoking status, then markSuccess transitions to succeeded", async () => {
    const storage = createInMemoryStorage();

    // invoke a connector call
    const step1 = await connectorCallHandler.invoke(
      { stepRef: "step-1", connectorType: "http", operation: "POST /api/kyc", input: '{"user":"alice"}', idempotencyKey: "idem-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const call = (step1 as any).call;
    expect((step1 as any).stepRef).toBe("step-1");

    // getResult should show invoking status
    const step2 = await connectorCallHandler.getResult(
      { call },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).status).toBe("invoking");

    // markSuccess transitions to succeeded
    const step3 = await connectorCallHandler.markSuccess(
      { call, output: '{"approved":true}' },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).output).toBe('{"approved":true}');

    // getResult should now show succeeded
    const step4 = await connectorCallHandler.getResult(
      { call },
      storage,
    );
    expect(step4.variant).toBe("ok");
    expect((step4 as any).status).toBe("succeeded");
  });

  it("invoke enforces idempotency key uniqueness", async () => {
    const storage = createInMemoryStorage();

    const step1 = await connectorCallHandler.invoke(
      { stepRef: "step-1", connectorType: "http", operation: "POST /api/check", input: "{}", idempotencyKey: "idem-dup" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // Same idempotency key should return duplicate
    const step2 = await connectorCallHandler.invoke(
      { stepRef: "step-2", connectorType: "grpc", operation: "Check", input: "{}", idempotencyKey: "idem-dup" },
      storage,
    );
    expect(step2.variant).toBe("duplicate");
    expect((step2 as any).idempotencyKey).toBe("idem-dup");
  });

  it("markFailure transitions to failed with error message", async () => {
    const storage = createInMemoryStorage();

    const step1 = await connectorCallHandler.invoke(
      { stepRef: "step-f", connectorType: "database", operation: "query:users", input: "{}", idempotencyKey: "idem-fail" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const call = (step1 as any).call;

    const step2 = await connectorCallHandler.markFailure(
      { call, error: "connection refused" },
      storage,
    );
    expect(step2.variant).toBe("error");
    expect((step2 as any).message).toBe("connection refused");

    const step3 = await connectorCallHandler.getResult(
      { call },
      storage,
    );
    expect((step3 as any).status).toBe("failed");
  });

  it("markSuccess on non-invoking call returns notInvoking", async () => {
    const storage = createInMemoryStorage();

    const step1 = await connectorCallHandler.invoke(
      { stepRef: "step-x", connectorType: "http", operation: "GET /health", input: "{}", idempotencyKey: "idem-ni" },
      storage,
    );
    const call = (step1 as any).call;

    // Complete it first
    await connectorCallHandler.markSuccess(
      { call, output: "done" },
      storage,
    );

    // Second markSuccess should fail
    const step2 = await connectorCallHandler.markSuccess(
      { call, output: "again" },
      storage,
    );
    expect(step2.variant).toBe("notInvoking");
  });

  it("getResult on unknown call returns notFound", async () => {
    const storage = createInMemoryStorage();

    const step1 = await connectorCallHandler.getResult(
      { call: "cc-nonexistent" },
      storage,
    );
    expect(step1.variant).toBe("notFound");
  });

});
