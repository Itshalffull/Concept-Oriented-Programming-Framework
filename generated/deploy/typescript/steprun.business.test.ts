import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { stepRunHandler } from "./steprun.impl";

describe("StepRun business logic", () => {
  it("retry scenario: start, fail, start same key increments attempt", async () => {
    const storage = createInMemoryStorage();

    // First attempt
    const attempt1 = await stepRunHandler.start(
      { run_ref: "run-1", step_key: "validate", step_type: "automation", input: '{"try":1}' },
      storage,
    );
    expect(attempt1.variant).toBe("ok");
    const step1 = (attempt1 as any).step;

    // Fail it
    await stepRunHandler.fail({ step: step1, error: "validation failed" }, storage);

    // Second attempt - same run_ref + step_key
    const attempt2 = await stepRunHandler.start(
      { run_ref: "run-1", step_key: "validate", step_type: "automation", input: '{"try":2}' },
      storage,
    );
    expect(attempt2.variant).toBe("ok");
    const step2 = (attempt2 as any).step;

    // Get the new step - attempt should be 2
    const got = await stepRunHandler.get({ step: step2 }, storage);
    expect(got.variant).toBe("ok");
    expect((got as any).attempt).toBe(2);
  });

  it("cancel an active step succeeds", async () => {
    const storage = createInMemoryStorage();
    const started = await stepRunHandler.start(
      { run_ref: "run-2", step_key: "process", step_type: "human", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    const result = await stepRunHandler.cancel({ step }, storage);
    expect(result.variant).toBe("ok");

    const got = await stepRunHandler.get({ step }, storage);
    expect((got as any).status).toBe("cancelled");
  });

  it("cancel a completed step returns not_cancellable", async () => {
    const storage = createInMemoryStorage();
    const started = await stepRunHandler.start(
      { run_ref: "run-3", step_key: "done", step_type: "automation", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    await stepRunHandler.complete({ step, output: '"result"' }, storage);
    const result = await stepRunHandler.cancel({ step }, storage);
    expect(result.variant).toBe("not_cancellable");
  });

  it("skip on non-pending step should fail", async () => {
    const storage = createInMemoryStorage();
    // Start creates an active step, not pending
    const started = await stepRunHandler.start(
      { run_ref: "run-4", step_key: "work", step_type: "automation", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    const result = await stepRunHandler.skip({ step, reason: "not needed" }, storage);
    expect(result.variant).toBe("not_pending");
  });

  it("complete then complete same step should reject", async () => {
    const storage = createInMemoryStorage();
    const started = await stepRunHandler.start(
      { run_ref: "run-5", step_key: "once", step_type: "automation", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    await stepRunHandler.complete({ step, output: '"first"' }, storage);
    const result = await stepRunHandler.complete({ step, output: '"second"' }, storage);
    expect(result.variant).toBe("not_active");
  });

  it("fail then skip should reject", async () => {
    const storage = createInMemoryStorage();
    const started = await stepRunHandler.start(
      { run_ref: "run-6", step_key: "fragile", step_type: "automation", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    await stepRunHandler.fail({ step, error: "oops" }, storage);
    const result = await stepRunHandler.skip({ step, reason: "too late" }, storage);
    expect(result.variant).toBe("not_pending");
  });

  it("get returns correct step_type and attempt count", async () => {
    const storage = createInMemoryStorage();
    const started = await stepRunHandler.start(
      { run_ref: "run-7", step_key: "check", step_type: "human", input: '{"form":"review"}' },
      storage,
    );
    const step = (started as any).step;

    const got = await stepRunHandler.get({ step }, storage);
    expect(got.variant).toBe("ok");
    expect((got as any).step_key).toBe("check");
    expect((got as any).run_ref).toBe("run-7");
    expect((got as any).status).toBe("active");
    expect((got as any).attempt).toBe(1);
  });

  it("multiple steps for same run_ref with different step_keys", async () => {
    const storage = createInMemoryStorage();

    const s1 = await stepRunHandler.start(
      { run_ref: "run-8", step_key: "init", step_type: "automation", input: "{}" },
      storage,
    );
    const s2 = await stepRunHandler.start(
      { run_ref: "run-8", step_key: "validate", step_type: "automation", input: "{}" },
      storage,
    );
    const s3 = await stepRunHandler.start(
      { run_ref: "run-8", step_key: "approve", step_type: "human", input: "{}" },
      storage,
    );

    expect(s1.variant).toBe("ok");
    expect(s2.variant).toBe("ok");
    expect(s3.variant).toBe("ok");

    // All have different step IDs
    const ids = [(s1 as any).step, (s2 as any).step, (s3 as any).step];
    expect(new Set(ids).size).toBe(3);

    // Complete one, others remain active
    await stepRunHandler.complete({ step: (s1 as any).step, output: '"done"' }, storage);
    const got1 = await stepRunHandler.get({ step: (s1 as any).step }, storage);
    const got2 = await stepRunHandler.get({ step: (s2 as any).step }, storage);
    expect((got1 as any).status).toBe("completed");
    expect((got2 as any).status).toBe("active");
  });

  it("starting same step_key while active returns already_active", async () => {
    const storage = createInMemoryStorage();

    const s1 = await stepRunHandler.start(
      { run_ref: "run-9", step_key: "exclusive", step_type: "automation", input: "{}" },
      storage,
    );
    expect(s1.variant).toBe("ok");

    const s2 = await stepRunHandler.start(
      { run_ref: "run-9", step_key: "exclusive", step_type: "automation", input: "{}" },
      storage,
    );
    expect(s2.variant).toBe("already_active");
  });

  it("get nonexistent step returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await stepRunHandler.get({ step: "step-999999" }, storage);
    expect(result.variant).toBe("not_found");
  });

  it("fail returns error variant with correct message", async () => {
    const storage = createInMemoryStorage();
    const started = await stepRunHandler.start(
      { run_ref: "run-10", step_key: "flaky", step_type: "automation", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    const failed = await stepRunHandler.fail({ step, error: "timeout exceeded" }, storage);
    expect(failed.variant).toBe("error");
    expect((failed as any).message).toBe("timeout exceeded");
    expect((failed as any).run_ref).toBe("run-10");
    expect((failed as any).step_key).toBe("flaky");
  });
});
