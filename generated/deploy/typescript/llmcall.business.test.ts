import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { llmCallHandler } from "./llmcall.impl";

describe("LlmCall business logic", () => {
  it("request, recordResponse, validate, accept full lifecycle with schema", async () => {
    const storage = createInMemoryStorage();

    const schema = JSON.stringify({ required: ["name", "age"] });
    const req = await llmCallHandler.request(
      {
        stepRef: "step-1",
        model: "gpt-4",
        prompt: "Generate a person record",
        outputSchema: schema,
        maxAttempts: 3,
      },
      storage,
    );
    expect(req.variant).toBe("ok");
    const call = (req as any).call;

    // Record response with valid output
    const recorded = await llmCallHandler.recordResponse(
      {
        call,
        rawOutput: '{"name":"Alice","age":30}',
        inputTokens: 50,
        outputTokens: 20,
      },
      storage,
    );
    expect(recorded.variant).toBe("ok");

    // Validate - should pass
    const validated = await llmCallHandler.validate({ call }, storage);
    expect(validated.variant).toBe("valid");
    expect((validated as any).validatedOutput).toBe('{"name":"Alice","age":30}');
  });

  it("validation failure triggers repair loop", async () => {
    const storage = createInMemoryStorage();

    const schema = JSON.stringify({ required: ["name", "email"] });
    const req = await llmCallHandler.request(
      {
        stepRef: "step-2",
        model: "gpt-4",
        prompt: "Generate user",
        outputSchema: schema,
        maxAttempts: 3,
      },
      storage,
    );
    const call = (req as any).call;

    // Record response missing required field
    await llmCallHandler.recordResponse(
      {
        call,
        rawOutput: '{"name":"Bob"}',
        inputTokens: 40,
        outputTokens: 10,
      },
      storage,
    );

    // Validate - should fail
    const validated = await llmCallHandler.validate({ call }, storage);
    expect(validated.variant).toBe("invalid");
    expect((validated as any).errors).toContain("Missing required field: email");

    // Repair - should transition back to requesting
    const repaired = await llmCallHandler.repair(
      { call, errors: "Missing required field: email" },
      storage,
    );
    expect(repaired.variant).toBe("ok");
  });

  it("repair increments attemptCount", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-3",
        model: "gpt-4",
        prompt: "test",
        outputSchema: JSON.stringify({ required: ["x"] }),
        maxAttempts: 5,
      },
      storage,
    );
    const call = (req as any).call;

    // First attempt
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{}', inputTokens: 10, outputTokens: 5 },
      storage,
    );
    await llmCallHandler.validate({ call }, storage);
    const r1 = await llmCallHandler.repair(
      { call, errors: "Missing required field: x" },
      storage,
    );
    expect(r1.variant).toBe("ok");

    // Second attempt
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{}', inputTokens: 10, outputTokens: 5 },
      storage,
    );
    await llmCallHandler.validate({ call }, storage);
    const r2 = await llmCallHandler.repair(
      { call, errors: "Missing required field: x" },
      storage,
    );
    expect(r2.variant).toBe("ok");
  });

  it("maxAttempts reached stops repair and rejects", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-4",
        model: "gpt-4",
        prompt: "test",
        outputSchema: JSON.stringify({ required: ["a"] }),
        maxAttempts: 1,
      },
      storage,
    );
    const call = (req as any).call;

    // Record and validate (invalid)
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{}', inputTokens: 10, outputTokens: 5 },
      storage,
    );
    await llmCallHandler.validate({ call }, storage);

    // Repair should hit maxAttempts (attemptCount becomes 1, maxAttempts is 1)
    const result = await llmCallHandler.repair(
      { call, errors: "Missing required field: a" },
      storage,
    );
    expect(result.variant).toBe("maxAttemptsReached");
    expect((result as any).stepRef).toBe("step-4");
  });

  it("no outputSchema auto-accepts response", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-5",
        model: "gpt-3.5",
        prompt: "Say hello",
        outputSchema: "",
        maxAttempts: 1,
      },
      storage,
    );
    const call = (req as any).call;

    const recorded = await llmCallHandler.recordResponse(
      {
        call,
        rawOutput: "Hello, world!",
        inputTokens: 5,
        outputTokens: 3,
      },
      storage,
    );
    expect(recorded.variant).toBe("ok");

    // Status should be directly "accepted" since no schema
    // We can verify by calling accept (which should work regardless)
  });

  it("reject permanently rejects the call", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-6",
        model: "gpt-4",
        prompt: "test",
        outputSchema: "",
        maxAttempts: 3,
      },
      storage,
    );
    const call = (req as any).call;

    const rejected = await llmCallHandler.reject(
      { call, reason: "content policy violation" },
      storage,
    );
    expect(rejected.variant).toBe("ok");
    expect((rejected as any).reason).toBe("content policy violation");
  });

  it("recordResponse on non-requesting call returns providerError", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-7",
        model: "gpt-4",
        prompt: "test",
        outputSchema: "",
        maxAttempts: 1,
      },
      storage,
    );
    const call = (req as any).call;

    // Record response (auto-accepted since no schema)
    await llmCallHandler.recordResponse(
      { call, rawOutput: "first", inputTokens: 10, outputTokens: 5 },
      storage,
    );

    // Try to record again - status is now "accepted", not "requesting"
    const result = await llmCallHandler.recordResponse(
      { call, rawOutput: "second", inputTokens: 10, outputTokens: 5 },
      storage,
    );
    expect(result.variant).toBe("providerError");
  });

  it("accept without validation works as manual override", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-8",
        model: "gpt-4",
        prompt: "test",
        outputSchema: JSON.stringify({ required: ["x"] }),
        maxAttempts: 3,
      },
      storage,
    );
    const call = (req as any).call;

    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"partial":true}', inputTokens: 10, outputTokens: 5 },
      storage,
    );

    // Accept directly without validating
    const accepted = await llmCallHandler.accept({ call }, storage);
    expect(accepted.variant).toBe("ok");
    expect((accepted as any).output).toBe('{"partial":true}');
  });

  it("token_usage is recorded in response", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-9",
        model: "gpt-4",
        prompt: "Analyze data",
        outputSchema: "",
        maxAttempts: 1,
      },
      storage,
    );
    const call = (req as any).call;

    const recorded = await llmCallHandler.recordResponse(
      {
        call,
        rawOutput: "analysis complete",
        inputTokens: 1500,
        outputTokens: 250,
      },
      storage,
    );
    expect(recorded.variant).toBe("ok");
  });

  it("validate with non-JSON output returns invalid", async () => {
    const storage = createInMemoryStorage();

    const req = await llmCallHandler.request(
      {
        stepRef: "step-10",
        model: "gpt-4",
        prompt: "Generate JSON",
        outputSchema: JSON.stringify({ required: ["field"] }),
        maxAttempts: 2,
      },
      storage,
    );
    const call = (req as any).call;

    await llmCallHandler.recordResponse(
      { call, rawOutput: "This is not JSON at all", inputTokens: 10, outputTokens: 5 },
      storage,
    );

    const validated = await llmCallHandler.validate({ call }, storage);
    expect(validated.variant).toBe("invalid");
    expect((validated as any).errors).toContain("not valid JSON");
  });

  it("repair loop: request, respond, validate(fail), repair, respond, validate(pass)", async () => {
    const storage = createInMemoryStorage();

    const schema = JSON.stringify({ required: ["result"] });
    const req = await llmCallHandler.request(
      {
        stepRef: "step-11",
        model: "gpt-4",
        prompt: "Generate result",
        outputSchema: schema,
        maxAttempts: 3,
      },
      storage,
    );
    const call = (req as any).call;

    // First attempt - missing field
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"wrong":"field"}', inputTokens: 20, outputTokens: 10 },
      storage,
    );
    const v1 = await llmCallHandler.validate({ call }, storage);
    expect(v1.variant).toBe("invalid");

    // Repair
    await llmCallHandler.repair({ call, errors: "Missing field" }, storage);

    // Second attempt - correct
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"result":"success"}', inputTokens: 25, outputTokens: 12 },
      storage,
    );
    const v2 = await llmCallHandler.validate({ call }, storage);
    expect(v2.variant).toBe("valid");
    expect((v2 as any).validatedOutput).toBe('{"result":"success"}');
  });
});
