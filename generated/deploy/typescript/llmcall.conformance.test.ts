// generated: llmcall.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { llmCallHandler } from "./llmcall.impl";

describe("LlmCall conformance", () => {

  it("request, recordResponse, validate flow for valid output", async () => {
    const storage = createInMemoryStorage();

    // Create a request
    const step1 = await llmCallHandler.request(
      { stepRef: "draft", model: "claude-sonnet-4-5-20250929", prompt: '{"text":"Write an email"}', outputSchema: '{"required":["subject","body"]}', maxAttempts: 3 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const call = (step1 as any).call;
    expect((step1 as any).stepRef).toBe("draft");
    expect((step1 as any).model).toBe("claude-sonnet-4-5-20250929");

    // Record the LLM response
    const step2 = await llmCallHandler.recordResponse(
      { call, rawOutput: '{"subject":"Hello","body":"World"}', inputTokens: 100, outputTokens: 200 },
      storage,
    );
    expect(step2.variant).toBe("ok");

    // Validate - should pass since output has required fields
    const step3 = await llmCallHandler.validate(
      { call },
      storage,
    );
    expect(step3.variant).toBe("valid");
    expect((step3 as any).stepRef).toBe("draft");
    expect((step3 as any).validatedOutput).toBe('{"subject":"Hello","body":"World"}');
  });

  it("validate detects missing required fields", async () => {
    const storage = createInMemoryStorage();

    const step1 = await llmCallHandler.request(
      { stepRef: "step-v", model: "gpt-4", prompt: "generate", outputSchema: '{"required":["name","age"]}', maxAttempts: 2 },
      storage,
    );
    const call = (step1 as any).call;

    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"name":"Alice"}', inputTokens: 50, outputTokens: 30 },
      storage,
    );

    const step3 = await llmCallHandler.validate(
      { call },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).errors).toContain("Missing required field: age");
  });

  it("repair loop: invalid -> repair -> requesting -> recordResponse -> validate valid", async () => {
    const storage = createInMemoryStorage();

    const step1 = await llmCallHandler.request(
      { stepRef: "step-r", model: "claude-sonnet-4-5-20250929", prompt: "fix output", outputSchema: '{"required":["result"]}', maxAttempts: 3 },
      storage,
    );
    const call = (step1 as any).call;

    // First attempt: bad output
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"wrong":"field"}', inputTokens: 10, outputTokens: 10 },
      storage,
    );

    const v1 = await llmCallHandler.validate({ call }, storage);
    expect(v1.variant).toBe("invalid");

    // Repair - sends back to requesting
    const r1 = await llmCallHandler.repair(
      { call, errors: (v1 as any).errors },
      storage,
    );
    expect(r1.variant).toBe("ok");

    // Second attempt: good output
    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"result":"correct"}', inputTokens: 15, outputTokens: 12 },
      storage,
    );

    const v2 = await llmCallHandler.validate({ call }, storage);
    expect(v2.variant).toBe("valid");
    expect((v2 as any).validatedOutput).toBe('{"result":"correct"}');
  });

  it("repair returns maxAttemptsReached when exhausted", async () => {
    const storage = createInMemoryStorage();

    const step1 = await llmCallHandler.request(
      { stepRef: "step-m", model: "gpt-4", prompt: "generate", outputSchema: '{"required":["x"]}', maxAttempts: 1 },
      storage,
    );
    const call = (step1 as any).call;

    await llmCallHandler.recordResponse(
      { call, rawOutput: '{"bad":true}', inputTokens: 5, outputTokens: 5 },
      storage,
    );

    await llmCallHandler.validate({ call }, storage);

    const r1 = await llmCallHandler.repair(
      { call, errors: "Missing required field: x" },
      storage,
    );
    expect(r1.variant).toBe("maxAttemptsReached");
    expect((r1 as any).stepRef).toBe("step-m");
  });

  it("accept manually accepts output bypassing validation", async () => {
    const storage = createInMemoryStorage();

    const step1 = await llmCallHandler.request(
      { stepRef: "step-a", model: "claude-sonnet-4-5-20250929", prompt: "write", outputSchema: "", maxAttempts: 1 },
      storage,
    );
    const call = (step1 as any).call;

    await llmCallHandler.recordResponse(
      { call, rawOutput: "free-form text output", inputTokens: 10, outputTokens: 20 },
      storage,
    );

    const step3 = await llmCallHandler.accept({ call }, storage);
    expect(step3.variant).toBe("ok");
    expect((step3 as any).output).toBe("free-form text output");
  });

  it("reject permanently rejects call output", async () => {
    const storage = createInMemoryStorage();

    const step1 = await llmCallHandler.request(
      { stepRef: "step-rej", model: "gpt-4", prompt: "generate", outputSchema: "", maxAttempts: 1 },
      storage,
    );
    const call = (step1 as any).call;

    await llmCallHandler.recordResponse(
      { call, rawOutput: "offensive content", inputTokens: 5, outputTokens: 5 },
      storage,
    );

    const step3 = await llmCallHandler.reject(
      { call, reason: "Content policy violation" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).reason).toBe("Content policy violation");
  });

  it("recordResponse without output schema transitions directly to accepted", async () => {
    const storage = createInMemoryStorage();

    const step1 = await llmCallHandler.request(
      { stepRef: "step-noschema", model: "claude-sonnet-4-5-20250929", prompt: "hello", outputSchema: "", maxAttempts: 1 },
      storage,
    );
    const call = (step1 as any).call;

    const step2 = await llmCallHandler.recordResponse(
      { call, rawOutput: "response text", inputTokens: 5, outputTokens: 10 },
      storage,
    );
    expect(step2.variant).toBe("ok");

    // Accept should work immediately
    const step3 = await llmCallHandler.accept({ call }, storage);
    expect(step3.variant).toBe("ok");
    expect((step3 as any).output).toBe("response text");
  });

});
