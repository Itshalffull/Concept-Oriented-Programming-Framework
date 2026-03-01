// generated: steprun.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { stepRunHandler } from "./steprun.impl";

describe("StepRun conformance", () => {

  it("invariant: after start, complete returns step with output", async () => {
    const storage = createInMemoryStorage();

    const started = await stepRunHandler.start(
      { run_ref: "r1", step_key: "kyc", step_type: "automation", input: '{"data":"check"}' },
      storage,
    );
    expect(started.variant).toBe("ok");
    const step = (started as any).step;
    expect((started as any).run_ref).toBe("r1");
    expect((started as any).step_key).toBe("kyc");
    expect((started as any).step_type).toBe("automation");

    const output = '{"verified":true}';
    const completed = await stepRunHandler.complete(
      { step, output },
      storage,
    );
    expect(completed.variant).toBe("ok");
    expect((completed as any).run_ref).toBe("r1");
    expect((completed as any).step_key).toBe("kyc");
    expect((completed as any).output).toBe(output);
  });

  it("start rejects duplicate active step for same run_ref+step_key", async () => {
    const storage = createInMemoryStorage();

    const first = await stepRunHandler.start(
      { run_ref: "r1", step_key: "review", step_type: "human", input: "{}" },
      storage,
    );
    expect(first.variant).toBe("ok");

    const second = await stepRunHandler.start(
      { run_ref: "r1", step_key: "review", step_type: "human", input: "{}" },
      storage,
    );
    expect(second.variant).toBe("already_active");
  });

  it("fail transitions active to failed with error message", async () => {
    const storage = createInMemoryStorage();

    const started = await stepRunHandler.start(
      { run_ref: "r1", step_key: "process", step_type: "automation", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    const failed = await stepRunHandler.fail(
      { step, error: "connection timeout" },
      storage,
    );
    expect(failed.variant).toBe("error");
    expect((failed as any).message).toBe("connection timeout");

    const got = await stepRunHandler.get({ step }, storage);
    expect((got as any).status).toBe("failed");
  });

  it("retry after failure increments attempt counter", async () => {
    const storage = createInMemoryStorage();

    const first = await stepRunHandler.start(
      { run_ref: "r1", step_key: "flaky", step_type: "automation", input: "{}" },
      storage,
    );
    const firstStep = (first as any).step;
    await stepRunHandler.fail({ step: firstStep, error: "transient error" }, storage);

    const retry = await stepRunHandler.start(
      { run_ref: "r1", step_key: "flaky", step_type: "automation", input: "{}" },
      storage,
    );
    expect(retry.variant).toBe("ok");

    const retryStep = (retry as any).step;
    const got = await stepRunHandler.get({ step: retryStep }, storage);
    expect((got as any).attempt).toBe(2);
  });

  it("cancel transitions active or pending to cancelled", async () => {
    const storage = createInMemoryStorage();

    const started = await stepRunHandler.start(
      { run_ref: "r1", step_key: "task", step_type: "human", input: "{}" },
      storage,
    );
    const step = (started as any).step;

    const cancelled = await stepRunHandler.cancel({ step }, storage);
    expect(cancelled.variant).toBe("ok");

    const got = await stepRunHandler.get({ step }, storage);
    expect((got as any).status).toBe("cancelled");
  });

  it("cancel rejects terminal step", async () => {
    const storage = createInMemoryStorage();

    const started = await stepRunHandler.start(
      { run_ref: "r1", step_key: "task", step_type: "human", input: "{}" },
      storage,
    );
    const step = (started as any).step;
    await stepRunHandler.complete({ step, output: "{}" }, storage);

    const result = await stepRunHandler.cancel({ step }, storage);
    expect(result.variant).toBe("not_cancellable");
  });

  it("get returns not_found for nonexistent step", async () => {
    const storage = createInMemoryStorage();
    const result = await stepRunHandler.get({ step: "nonexistent" }, storage);
    expect(result.variant).toBe("not_found");
  });

  it("complete rejects non-active step", async () => {
    const storage = createInMemoryStorage();

    const started = await stepRunHandler.start(
      { run_ref: "r1", step_key: "task", step_type: "human", input: "{}" },
      storage,
    );
    const step = (started as any).step;
    await stepRunHandler.cancel({ step }, storage);

    const result = await stepRunHandler.complete({ step, output: "{}" }, storage);
    expect(result.variant).toBe("not_active");
  });
});
