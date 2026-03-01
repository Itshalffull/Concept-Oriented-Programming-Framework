import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processRunHandler } from "./processrun.impl";

describe("ProcessRun business logic", () => {
  it("multiple concurrent runs from same spec are independent", async () => {
    const storage = createInMemoryStorage();

    const run1 = await processRunHandler.start(
      { spec_ref: "spec-A", spec_version: 1, input: '{"batch":1}' },
      storage,
    );
    const run2 = await processRunHandler.start(
      { spec_ref: "spec-A", spec_version: 1, input: '{"batch":2}' },
      storage,
    );
    expect(run1.variant).toBe("ok");
    expect(run2.variant).toBe("ok");
    expect((run1 as any).run).not.toBe((run2 as any).run);

    // Complete one, the other should still be running
    await processRunHandler.complete(
      { run: (run1 as any).run, output: '{"done":true}' },
      storage,
    );

    const status1 = await processRunHandler.getStatus(
      { run: (run1 as any).run },
      storage,
    );
    const status2 = await processRunHandler.getStatus(
      { run: (run2 as any).run },
      storage,
    );
    expect((status1 as any).status).toBe("completed");
    expect((status2 as any).status).toBe("running");
  });

  it("complete then fail same run should reject the fail", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-B", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    await processRunHandler.complete({ run, output: '"ok"' }, storage);
    const failResult = await processRunHandler.fail(
      { run, error: "too late" },
      storage,
    );
    expect(failResult.variant).toBe("not_running");
  });

  it("fail then cancel should reject the cancel", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-C", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    await processRunHandler.fail({ run, error: "crash" }, storage);
    const cancelResult = await processRunHandler.cancel({ run }, storage);
    expect(cancelResult.variant).toBe("not_cancellable");
  });

  it("suspend then cancel should work", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-D", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    await processRunHandler.suspend({ run }, storage);
    const cancelResult = await processRunHandler.cancel({ run }, storage);
    expect(cancelResult.variant).toBe("ok");

    const status = await processRunHandler.getStatus({ run }, storage);
    expect((status as any).status).toBe("cancelled");
  });

  it("suspend then complete should reject (not_running)", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-E", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    await processRunHandler.suspend({ run }, storage);
    const completeResult = await processRunHandler.complete(
      { run, output: '"nope"' },
      storage,
    );
    expect(completeResult.variant).toBe("not_running");
  });

  it("resume on a running run returns not_suspended", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-F", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    const resumeResult = await processRunHandler.resume({ run }, storage);
    expect(resumeResult.variant).toBe("not_suspended");
  });

  it("start with empty input and complete", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-G", spec_version: 1, input: "" },
      storage,
    );
    expect(started.variant).toBe("ok");
    const run = (started as any).run;

    const completed = await processRunHandler.complete(
      { run, output: '{"result":"empty input ok"}' },
      storage,
    );
    expect(completed.variant).toBe("ok");
  });

  it("child run lifecycle is independent of parent", async () => {
    const storage = createInMemoryStorage();
    const parent = await processRunHandler.start(
      { spec_ref: "spec-parent", spec_version: 1, input: '{"parent":true}' },
      storage,
    );
    const parentRun = (parent as any).run;

    const child = await processRunHandler.startChild(
      {
        spec_ref: "spec-child",
        spec_version: 1,
        parent_run: parentRun,
        input: '{"child":true}',
      },
      storage,
    );
    expect(child.variant).toBe("ok");
    const childRun = (child as any).run;
    expect((child as any).parent_run).toBe(parentRun);

    // Complete child, parent should still be running
    await processRunHandler.complete(
      { run: childRun, output: '"child done"' },
      storage,
    );

    const parentStatus = await processRunHandler.getStatus(
      { run: parentRun },
      storage,
    );
    const childStatus = await processRunHandler.getStatus(
      { run: childRun },
      storage,
    );
    expect((parentStatus as any).status).toBe("running");
    expect((childStatus as any).status).toBe("completed");

    // Fail parent, child remains completed
    await processRunHandler.fail(
      { run: parentRun, error: "parent error" },
      storage,
    );
    const childStatusAfter = await processRunHandler.getStatus(
      { run: childRun },
      storage,
    );
    expect((childStatusAfter as any).status).toBe("completed");
  });

  it("getStatus returns correct spec_ref and run id", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "my-spec-ref", spec_version: 3, input: '{"data":42}' },
      storage,
    );
    const run = (started as any).run;

    const status = await processRunHandler.getStatus({ run }, storage);
    expect(status.variant).toBe("ok");
    expect((status as any).run).toBe(run);
    expect((status as any).spec_ref).toBe("my-spec-ref");
    expect((status as any).status).toBe("running");
  });

  it("getStatus on nonexistent run returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await processRunHandler.getStatus(
      { run: "run-999999" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });

  it("suspend then resume then complete works end to end", async () => {
    const storage = createInMemoryStorage();
    const started = await processRunHandler.start(
      { spec_ref: "spec-H", spec_version: 1, input: "{}" },
      storage,
    );
    const run = (started as any).run;

    await processRunHandler.suspend({ run }, storage);
    let status = await processRunHandler.getStatus({ run }, storage);
    expect((status as any).status).toBe("suspended");

    await processRunHandler.resume({ run }, storage);
    status = await processRunHandler.getStatus({ run }, storage);
    expect((status as any).status).toBe("running");

    await processRunHandler.complete({ run, output: '"resumed and done"' }, storage);
    status = await processRunHandler.getStatus({ run }, storage);
    expect((status as any).status).toBe("completed");
  });
});
