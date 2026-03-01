import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { connectorCallHandler } from "./connectorcall.impl";

describe("ConnectorCall business logic", () => {
  it("idempotency key prevents duplicate invocations", async () => {
    const storage = createInMemoryStorage();

    const first = await connectorCallHandler.invoke(
      {
        stepRef: "step-1",
        connectorType: "http",
        operation: "POST /api/submit",
        input: '{"data":"payload"}',
        idempotencyKey: "unique-key-001",
      },
      storage,
    );
    expect(first.variant).toBe("ok");

    const duplicate = await connectorCallHandler.invoke(
      {
        stepRef: "step-1",
        connectorType: "http",
        operation: "POST /api/submit",
        input: '{"data":"payload"}',
        idempotencyKey: "unique-key-001",
      },
      storage,
    );
    expect(duplicate.variant).toBe("duplicate");
    expect((duplicate as any).idempotencyKey).toBe("unique-key-001");
  });

  it("invoke then markSuccess full lifecycle", async () => {
    const storage = createInMemoryStorage();

    const invoked = await connectorCallHandler.invoke(
      {
        stepRef: "step-2",
        connectorType: "grpc",
        operation: "UserService.Create",
        input: '{"name":"alice"}',
        idempotencyKey: "idem-success",
      },
      storage,
    );
    const call = (invoked as any).call;

    // Verify invoking state
    const midResult = await connectorCallHandler.getResult({ call }, storage);
    expect((midResult as any).status).toBe("invoking");

    const success = await connectorCallHandler.markSuccess(
      { call, output: '{"id":"user-123"}' },
      storage,
    );
    expect(success.variant).toBe("ok");
    expect((success as any).output).toBe('{"id":"user-123"}');
    expect((success as any).stepRef).toBe("step-2");

    const finalResult = await connectorCallHandler.getResult({ call }, storage);
    expect((finalResult as any).status).toBe("succeeded");
    expect((finalResult as any).output).toBe('{"id":"user-123"}');
  });

  it("invoke then markFailure transitions to failed", async () => {
    const storage = createInMemoryStorage();

    const invoked = await connectorCallHandler.invoke(
      {
        stepRef: "step-3",
        connectorType: "database",
        operation: "INSERT users",
        input: '{"name":"bob"}',
        idempotencyKey: "idem-fail",
      },
      storage,
    );
    const call = (invoked as any).call;

    const failure = await connectorCallHandler.markFailure(
      { call, error: "constraint violation: duplicate email" },
      storage,
    );
    expect(failure.variant).toBe("error");
    expect((failure as any).message).toBe("constraint violation: duplicate email");
    expect((failure as any).stepRef).toBe("step-3");

    const result = await connectorCallHandler.getResult({ call }, storage);
    expect((result as any).status).toBe("failed");
  });

  it("markSuccess on non-invoking (already succeeded) rejects", async () => {
    const storage = createInMemoryStorage();

    const invoked = await connectorCallHandler.invoke(
      {
        stepRef: "step-4",
        connectorType: "http",
        operation: "GET /status",
        input: "{}",
        idempotencyKey: "idem-double-success",
      },
      storage,
    );
    const call = (invoked as any).call;

    await connectorCallHandler.markSuccess({ call, output: '"ok"' }, storage);

    const second = await connectorCallHandler.markSuccess(
      { call, output: '"again"' },
      storage,
    );
    expect(second.variant).toBe("notInvoking");
  });

  it("markFailure on already-succeeded call rejects", async () => {
    const storage = createInMemoryStorage();

    const invoked = await connectorCallHandler.invoke(
      {
        stepRef: "step-5",
        connectorType: "http",
        operation: "POST /webhook",
        input: "{}",
        idempotencyKey: "idem-success-then-fail",
      },
      storage,
    );
    const call = (invoked as any).call;

    await connectorCallHandler.markSuccess({ call, output: '"done"' }, storage);

    const result = await connectorCallHandler.markFailure(
      { call, error: "too late" },
      storage,
    );
    expect(result.variant).toBe("notInvoking");
  });

  it("getResult after success returns output", async () => {
    const storage = createInMemoryStorage();

    const invoked = await connectorCallHandler.invoke(
      {
        stepRef: "step-6",
        connectorType: "smtp",
        operation: "send_email",
        input: '{"to":"test@example.com"}',
        idempotencyKey: "idem-email",
      },
      storage,
    );
    const call = (invoked as any).call;

    await connectorCallHandler.markSuccess(
      { call, output: '{"messageId":"msg-456"}' },
      storage,
    );

    const result = await connectorCallHandler.getResult({ call }, storage);
    expect(result.variant).toBe("ok");
    expect((result as any).output).toBe('{"messageId":"msg-456"}');
  });

  it("getResult on nonexistent call returns notFound", async () => {
    const storage = createInMemoryStorage();
    const result = await connectorCallHandler.getResult(
      { call: "cc-does-not-exist" },
      storage,
    );
    expect(result.variant).toBe("notFound");
  });

  it("different connector types are handled correctly", async () => {
    const storage = createInMemoryStorage();

    const types = ["http", "grpc", "database", "queue", "smtp", "sftp"];
    for (const connectorType of types) {
      const result = await connectorCallHandler.invoke(
        {
          stepRef: `step-${connectorType}`,
          connectorType,
          operation: `${connectorType}_operation`,
          input: "{}",
          idempotencyKey: `idem-${connectorType}`,
        },
        storage,
      );
      expect(result.variant).toBe("ok");

      const call = (result as any).call;
      const getResult = await connectorCallHandler.getResult({ call }, storage);
      expect((getResult as any).status).toBe("invoking");
    }
  });

  it("markSuccess on nonexistent call returns notInvoking", async () => {
    const storage = createInMemoryStorage();
    const result = await connectorCallHandler.markSuccess(
      { call: "cc-ghost", output: "nope" },
      storage,
    );
    expect(result.variant).toBe("notInvoking");
  });

  it("markFailure on nonexistent call returns notInvoking", async () => {
    const storage = createInMemoryStorage();
    const result = await connectorCallHandler.markFailure(
      { call: "cc-ghost", error: "no such call" },
      storage,
    );
    expect(result.variant).toBe("notInvoking");
  });
});
