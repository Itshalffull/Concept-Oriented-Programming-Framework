// generated: processrun.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processRunHandler } from "./processrun.impl";

describe("ProcessRun conformance", () => {

  it("invariant: after start, getStatus returns running, then complete transitions to completed", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "onboard", spec_version: 1, input: "{}" },
      storage,
    );
    expect(started.variant).toBe("ok");
    const run = (started as any).run;
    expect((started as any).spec_ref).toBe("onboard");

    const status1 = await processRunHandler.getStatus({ run }, storage);
    expect(status1.variant).toBe("ok");
    expect((status1 as any).status).toBe("running");
    expect((status1 as any).spec_ref).toBe("onboard");

    const completed = await processRunHandler.complete(
      { run, output: '{"result":"done"}' },
      storage,
    );
    expect(completed.variant).toBe("ok");

    const status2 = await processRunHandler.getStatus({ run }, storage);
    expect((status2 as any).status).toBe("completed");
  });

  it("startChild creates a child run linked to parent", async () => {
    const storage = createInMemoryStorage();

    const parent = await processRunHandler.start(
      { spec_ref: "main", spec_version: 1, input: "{}" },
      storage,
    );
    const parentRun = (parent as any).run;

    const child = await processRunHandler.startChild(
      { spec_ref: "sub", spec_version: 1, parent_run: parentRun, input: "{}" },
      storage,
    );
    expect(child.variant).toBe("ok");
    expect((child as any).parent_run).toBe(parentRun);
  });

  it("fail transitions running to failed with error", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    const failed = await processRunHandler.fail(
      { run, error: "timeout exceeded" },
      storage,
    );
    expect(failed.variant).toBe("ok");
    expect((failed as any).error).toBe("timeout exceeded");

    const status = await processRunHandler.getStatus({ run }, storage);
    expect((status as any).status).toBe("failed");
  });

  it("cancel transitions running or suspended to cancelled", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    const cancelled = await processRunHandler.cancel({ run }, storage);
    expect(cancelled.variant).toBe("ok");

    const status = await processRunHandler.getStatus({ run }, storage);
    expect((status as any).status).toBe("cancelled");
  });

  it("cancel rejects already-terminal runs", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;
    await processRunHandler.complete({ run, output: "{}" }, storage);

    const result = await processRunHandler.cancel({ run }, storage);
    expect(result.variant).toBe("not_cancellable");
  });

  it("suspend and resume lifecycle", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    const suspended = await processRunHandler.suspend({ run }, storage);
    expect(suspended.variant).toBe("ok");

    const status1 = await processRunHandler.getStatus({ run }, storage);
    expect((status1 as any).status).toBe("suspended");

    const resumed = await processRunHandler.resume({ run }, storage);
    expect(resumed.variant).toBe("ok");

    const status2 = await processRunHandler.getStatus({ run }, storage);
    expect((status2 as any).status).toBe("running");
  });

  it("suspend rejects non-running run", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;
    await processRunHandler.complete({ run, output: "{}" }, storage);

    const result = await processRunHandler.suspend({ run }, storage);
    expect(result.variant).toBe("not_running");
  });

  it("resume rejects non-suspended run", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    const result = await processRunHandler.resume({ run }, storage);
    expect(result.variant).toBe("not_suspended");
  });

  it("getStatus returns not_found for nonexistent run", async () => {
    const storage = createInMemoryStorage();
    const result = await processRunHandler.getStatus({ run: "nonexistent" }, storage);
    expect(result.variant).toBe("not_found");
  });

  it("complete rejects non-running run", async () => {
    const storage = createInMemoryStorage();

    const started = await processRunHandler.start(
      { spec_ref: "proc", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;
    await processRunHandler.suspend({ run }, storage);

    const result = await processRunHandler.complete({ run, output: "{}" }, storage);
    expect(result.variant).toBe("not_running");
  });
});
